<?php
// seed-course-setup.php — completa el seeding con la API de Moodle (SPECS.md §1.2).
// Cubre lo que moosh no puede en 4.5:
//   1. Matriculaciones (hallazgo 2026-07-11: moosh course-enrol pierde $CFG->dirroot en 4.5).
//   2. Slots fijos + 1 pregunta aleatoria en los quizzes.
// Idempotente. Uso: php /tmp/seed-course-setup.php --shortname=QA-EXAMS-101

define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->dirroot . '/mod/quiz/locallib.php');
require_once($CFG->libdir . '/enrollib.php');
require_once($CFG->libdir . '/clilib.php');

// El CLI corre sin sesión: actuar como admin (quiz_add_random_questions exige
// la capability "useall") y no intentar enviar emails (SMTP no configurado).
\core\session\manager::set_user(get_admin());
$CFG->noemailever = true;

list($options, $unrecognized) = cli_get_params([
    'shortname' => 'QA-EXAMS-101',
    'teacher'   => 'teacher1',
    'teachers2' => 'teacher2',
    'students'  => 'student1,student2',
], []);

$course = $DB->get_record('course', ['shortname' => $options['shortname']], '*', MUST_EXIST);
$coursectx = context_course::instance($course->id);

// ---------- 1. Matriculaciones ----------
mtrace('==> Matriculaciones (API enrol_try_internal_enrol)');
$enrolments = [$options['teacher'] => 'editingteacher'];
foreach (explode(',', $options['teachers2'] ?? '') as $t2) {
    if (trim($t2) !== '') {
        $enrolments[trim($t2)] = 'editingteacher';
    }
}
foreach (explode(',', $options['students']) as $s) {
    $enrolments[trim($s)] = 'student';
}
foreach ($enrolments as $username => $rolename) {
    $user = $DB->get_record('user', ['username' => $username, 'deleted' => 0], '*', MUST_EXIST);
    $role = $DB->get_record('role', ['shortname' => $rolename], '*', MUST_EXIST);
    if (is_enrolled($coursectx, $user)) {
        mtrace("    $username: ya matriculado");
        continue;
    }
    if (!enrol_try_internal_enrol($course->id, $user->id, $role->id)) {
        cli_error("No se pudo matricular a $username");
    }
    mtrace("    $username matriculado como $rolename");
}

// ---------- 1b. Editor plano para usuarios de prueba ----------
// TinyMCE es la mayor fuente de flakiness E2E (iframes, init async). Con la
// preferencia 'textarea' los campos ricos son <textarea> planos y estables.
mtrace('==> Preferencia de editor plano (textarea) para usuarios de prueba');
foreach (array_keys($enrolments) as $username) {
    $u = $DB->get_record('user', ['username' => $username, 'deleted' => 0], '*', MUST_EXIST);
    set_user_preference('htmleditor', 'textarea', $u);
    mtrace("    $username: htmleditor=textarea");
}

// ---------- 2. Preguntas en los quizzes ----------
// Última versión de cada pregunta SEED-* (el banco 4.x versiona las preguntas).
$seedquestions = $DB->get_records_sql("
    SELECT q.id, q.name, q.qtype
      FROM {question} q
      JOIN {question_versions} qv ON qv.questionid = q.id
      JOIN {question_bank_entries} qbe ON qbe.id = qv.questionbankentryid
     WHERE q.name LIKE 'SEED-%'
       AND qv.version = (SELECT MAX(v2.version) FROM {question_versions} v2
                          WHERE v2.questionbankentryid = qbe.id)
  ORDER BY q.name");

if (count($seedquestions) < 6) {
    cli_error('Se esperaban >= 6 preguntas SEED-* en el banco; hay ' . count($seedquestions));
}

$byname = [];
foreach ($seedquestions as $q) {
    $byname[$q->name] = $q;
}

$seedcategory = $DB->get_record('question_categories',
    ['name' => 'SEED', 'contextid' => $coursectx->id]);

// Hallazgo 2026-07-11: moosh questioncategory-create inserta con parent=0 en vez de
// colgar de la categoría 'top' del contexto — el banco de preguntas no la muestra.
// Reparentar vía API (question_get_top_category crea 'top' si no existe).
if ($seedcategory && $seedcategory->parent == 0) {
    $top = question_get_top_category($coursectx->id, true);
    if ($seedcategory->id != $top->id) {
        $DB->set_field('question_categories', 'parent', $top->id, ['id' => $seedcategory->id]);
        $seedcategory->parent = $top->id;
        mtrace("    categoría SEED reparentada bajo top (id={$top->id})");
    }
}

/**
 * Agrega preguntas fijas (+ opcionalmente 1 aleatoria) a un quiz si aún no tiene slots.
 */
function seed_quiz(string $quizname, array $questions, ?stdClass $randomcategory, stdClass $course): void {
    global $DB;

    $quiz = $DB->get_record('quiz', ['course' => $course->id, 'name' => $quizname], '*', MUST_EXIST);
    $changed = false;

    // Slots fijos: solo si el quiz está vacío (idempotencia).
    $existing = $DB->count_records('quiz_slots', ['quizid' => $quiz->id]);
    if ($existing > 0) {
        mtrace("    $quizname: ya tiene $existing slots fijos");
    } else {
        foreach ($questions as $q) {
            quiz_add_quiz_question($q->id, $quiz);
            mtrace("    $quizname: + {$q->name} ({$q->qtype})");
        }
        $changed = true;
    }

    // Pregunta aleatoria: chequeo independiente (en 4.x vive en question_set_references).
    if ($randomcategory !== null) {
        $hasrandom = $DB->count_records_sql("
            SELECT COUNT(1)
              FROM {question_set_references} qsr
              JOIN {quiz_slots} s ON s.id = qsr.itemid
             WHERE qsr.component = 'mod_quiz' AND qsr.questionarea = 'slot'
               AND s.quizid = ?", [$quiz->id]) > 0;
        if ($hasrandom) {
            mtrace("    $quizname: ya tiene pregunta aleatoria");
        } else {
            try {
                quiz_add_random_questions($quiz, 0, $randomcategory->id, 1);
                mtrace("    $quizname: + 1 pregunta aleatoria (cat SEED id={$randomcategory->id})");
                $changed = true;
            } catch (Throwable $e) {
                // Firma cambiante entre versiones 4.x: documentar como hallazgo si falla.
                mtrace("    $quizname: WARN pregunta aleatoria no agregada: " . $e->getMessage());
            }
        }
    }

    if (!$changed) {
        return;
    }

    // Recalcular sumgrades y fijar la nota máxima del quiz = suma de puntos (asserts exactos, flujo 9).
    $quiz = $DB->get_record('quiz', ['id' => $quiz->id], '*', MUST_EXIST);
    if (class_exists('\mod_quiz\quiz_settings')) {
        $calc = \mod_quiz\quiz_settings::create($quiz->id)->get_grade_calculator();
        $calc->recompute_quiz_sumgrades();
        $quiz = $DB->get_record('quiz', ['id' => $quiz->id], '*', MUST_EXIST);
        $calc->update_quiz_maximum_grade($quiz->sumgrades);
    } else {
        quiz_update_sumgrades($quiz);
        $quiz = $DB->get_record('quiz', ['id' => $quiz->id], '*', MUST_EXIST);
        quiz_set_grade($quiz->sumgrades, $quiz);
    }
    mtrace("    $quizname: sumgrades={$quiz->sumgrades}, nota máxima alineada");
}

// Fijas = SOLO las 6 base, por lista explícita. Las 2 de reserva (SEED-MC-02/TF-02)
// existen únicamente como pool del slot aleatorio (F14): si se fijaran también,
// el pool volvería a quedar vacío y el quiz tendría 9 slots (regresión cazada por
// el CI en instalación fresca — el entorno incremental local no la veía).
$fixednames = ['SEED-ESSAY-01', 'SEED-MATCH-01', 'SEED-MC-01', 'SEED-NUM-01', 'SEED-SA-01', 'SEED-TF-01'];
$fixed = [];
foreach ($fixednames as $fname) {
    if (!isset($byname[$fname])) {
        cli_error("Falta la pregunta base $fname en el banco");
    }
    $fixed[] = $byname[$fname];
}

mtrace('==> quiz-general (6 fijas + 1 aleatoria)');
seed_quiz('quiz-general', $fixed, $seedcategory ?: null, $course);

mtrace('==> quiz-timed (MC + TF, rápidas de responder)');
seed_quiz('quiz-timed', [$byname['SEED-MC-01'], $byname['SEED-TF-01']], null, $course);

mtrace('==> quiz-autosubmit (MC + TF — flujo 7: auto-envío al expirar)');
seed_quiz('quiz-autosubmit', [$byname['SEED-MC-01'], $byname['SEED-TF-01']], null, $course);

mtrace('OK');
