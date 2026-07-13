<?php
// e2e-helpers.php — utilidades puntuales que los specs invocan vía docker exec.
// Subcomandos:
//   userid <username>                  → imprime el id del usuario
//   set-graceguard <pct> <enabled>     → configura local_graceguard (spec 10)
//   delete-quiz <shortname> <quizname> → borra el quiz si existe (idempotencia de specs que crean quizzes por UI)
//   close-quiz <shortname> <quizname> <timeclose> → fija timeclose (0 = sin cierre) y purga caches (flujo 4)

define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->dirroot . '/course/lib.php');

$cmd = $argv[1] ?? '';

switch ($cmd) {
    case 'userid':
        $u = $DB->get_record('user', ['username' => $argv[2], 'deleted' => 0], 'id', MUST_EXIST);
        echo $u->id, PHP_EOL;
        break;

    case 'set-graceguard':
        set_config('penaltypct', (int) $argv[2], 'local_graceguard');
        set_config('enabled', (int) $argv[3], 'local_graceguard');
        echo 'ok penaltypct=', (int) $argv[2], ' enabled=', (int) $argv[3], PHP_EOL;
        break;

    case 'delete-quiz': {
        // get_records (plural), no get_record: si un teardown previo dejó duplicados,
        // get_record lanza "Multiple records found" y los duplicados nunca se limpian
        // (snowball que volvía el flujo 4 flaky→determinista). Se borran TODOS.
        $course = $DB->get_record('course', ['shortname' => $argv[2]], '*', MUST_EXIST);
        $quizzes = $DB->get_records('quiz', ['course' => $course->id, 'name' => $argv[3]]);
        $n = 0;
        foreach ($quizzes as $quiz) {
            [$c, $cm] = get_course_and_cm_from_instance($quiz, 'quiz');
            course_delete_module($cm->id);
            $n++;
        }
        echo $n > 0 ? "deleted=$n\n" : "absent\n";
        break;
    }

    case 'close-quiz': {
        // Cierra TODAS las instancias con ese nombre (robusto ante duplicados).
        $course = $DB->get_record('course', ['shortname' => $argv[2]], '*', MUST_EXIST);
        $quizzes = $DB->get_records('quiz', ['course' => $course->id, 'name' => $argv[3]]);
        if (!$quizzes) {
            echo "absent\n";
            break;
        }
        foreach ($quizzes as $quiz) {
            $DB->set_field('quiz', 'timeclose', (int) $argv[4], ['id' => $quiz->id]);
        }
        purge_all_caches();
        echo 'ok timeclose=', (int) $argv[4], ' n=', count($quizzes), PHP_EOL;
        break;
    }

    case 'delete-questions': {
        // Limpia preguntas creadas por specs vía UI (idempotencia entre corridas).
        require_once($CFG->libdir . '/questionlib.php');
        $like = $DB->sql_like('name', '?');
        $qs = $DB->get_records_select('question', $like, [$argv[2] . '%'], '', 'id, name');
        $n = 0;
        foreach ($qs as $q) {
            question_delete_question($q->id);
            $n++;
        }
        echo "deleted=$n\n";
        break;
    }

    default:
        fwrite(STDERR, "Subcomando desconocido: $cmd\n");
        exit(1);
}
