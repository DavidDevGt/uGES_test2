<?php
namespace local_focusguard\external;

use core_external\external_api;
use core_external\external_function_parameters;
use core_external\external_single_structure;
use core_external\external_value;

/**
 * WS local_focusguard_report_blur: incrementa el conteo de pérdidas de foco de un intento.
 *
 * Seguridad (SPECS §2.3): solo el dueño del intento, y solo mientras está inprogress.
 * Un estudiante no puede reportar blur sobre un intento ajeno.
 */
class report_blur extends external_api {

    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'attemptid' => new external_value(PARAM_INT, 'The quiz attempt id'),
        ]);
    }

    public static function execute(int $attemptid): array {
        global $DB, $USER;

        $params = self::validate_parameters(self::execute_parameters(), ['attemptid' => $attemptid]);

        $attempt = $DB->get_record('quiz_attempts', ['id' => $params['attemptid']], '*', MUST_EXIST);
        $quiz = $DB->get_record('quiz', ['id' => $attempt->quiz], '*', MUST_EXIST);
        [$course, $cm] = get_course_and_cm_from_instance($quiz, 'quiz');

        // Valida sesión, acceso al curso y contexto (patrón obligatorio de external_api).
        self::validate_context(\context_module::instance($cm->id));

        if ((int) $attempt->userid !== (int) $USER->id) {
            throw new \moodle_exception('accessdenied', 'admin');
        }
        if ($attempt->state !== 'inprogress') {
            throw new \moodle_exception('invalidattemptstate', 'local_focusguard');
        }

        // Upsert por attemptid (KEY unique en install.xml).
        $existing = $DB->get_record('local_focusguard_counts', ['attemptid' => $attempt->id]);
        if ($existing) {
            $existing->blurcount++;
            $existing->timemodified = time();
            $DB->update_record('local_focusguard_counts', $existing);
            $count = (int) $existing->blurcount;
        } else {
            $DB->insert_record('local_focusguard_counts', (object) [
                'attemptid'    => $attempt->id,
                'userid'       => $USER->id,
                'quizid'       => $attempt->quiz,
                'blurcount'    => 1,
                'timemodified' => time(),
            ]);
            $count = 1;
        }

        return ['count' => $count];
    }

    public static function execute_returns(): external_single_structure {
        return new external_single_structure([
            'count' => new external_value(PARAM_INT, 'Updated focus loss count'),
        ]);
    }
}
