<?php
namespace local_graceguard;

use core\hook\output\before_footer_html_generation;
use html_writer;

/**
 * Mensaje al estudiante en la página de revisión del intento (SPECS §3.1.3):
 * "nota original → penalización % → nota final", leído de local_graceguard_log.
 */
class hook_callbacks {

    public static function before_footer(before_footer_html_generation $hook): void {
        global $PAGE, $DB, $USER;

        if ($PAGE->pagetype !== 'mod-quiz-review') {
            return;
        }

        $attemptid = optional_param('attempt', 0, PARAM_INT);
        if ($attemptid <= 0) {
            return;
        }

        $log = $DB->get_record('local_graceguard_log', ['attemptid' => $attemptid]);
        if (!$log) {
            return; // Sin penalización → sin mensaje (SPECS §3.3).
        }

        // Visible para el dueño del intento y para quien puede ver reportes (profesor).
        $isowner = (int) $log->userid === (int) $USER->id;
        if (!$isowner && !has_capability('mod/quiz:viewreports', $PAGE->context)) {
            return;
        }

        $notice = get_string('penaltynotice', 'local_graceguard', (object) [
            'original'   => format_float((float) $log->original_grade, 2),
            'penaltypct' => (int) $log->penalty_pct,
            'final'      => format_float((float) $log->final_grade, 2),
        ]);

        $hook->add_html(html_writer::div($notice, 'alert alert-warning', [
            'id'   => 'local-graceguard-notice',
            'role' => 'status',
        ]));
    }
}
