<?php
namespace local_focusguard;

use core\hook\output\before_footer_html_generation;
use html_writer;

/**
 * Callbacks de la Hooks API (SPECS §2.2).
 *
 * - Página del intento (mod-quiz-attempt): inyecta el módulo AMD que escucha
 *   blur/visibilitychange y reporta por AJAX.
 * - Página del reporte de intentos del profesor (mod-quiz-report): embebe los
 *   conteos como JSON en un data-attribute (1 sola query en servidor, sin
 *   segunda llamada AJAX) y el módulo AMD decora las filas con el badge.
 */
class hook_callbacks {

    /** Umbral de marcado visual, hardcodeado según enunciado (SPECS §2.2). */
    const ALERT_THRESHOLD = 3;

    public static function before_footer(before_footer_html_generation $hook): void {
        global $PAGE;

        switch ($PAGE->pagetype) {
            case 'mod-quiz-attempt':
                self::inject_attempt_tracker();
                break;
            case 'mod-quiz-report':
                self::inject_report_badges($hook);
                break;
        }
    }

    /** Tracking de foco: solo mientras el estudiante rinde el intento. */
    private static function inject_attempt_tracker(): void {
        global $PAGE;

        $attemptid = optional_param('attempt', 0, PARAM_INT);
        if ($attemptid <= 0) {
            return;
        }
        $PAGE->requires->js_call_amd('local_focusguard/main', 'init', [$attemptid]);
    }

    /** Badges en la vista del profesor: datos embebidos, decoración en cliente. */
    private static function inject_report_badges(before_footer_html_generation $hook): void {
        global $PAGE, $DB;

        if (!$PAGE->cm || $PAGE->cm->modname !== 'quiz') {
            return;
        }

        $records = $DB->get_records('local_focusguard_counts',
            ['quizid' => (int) $PAGE->cm->instance], '', 'attemptid, blurcount');

        $counts = [];
        foreach ($records as $r) {
            $counts[(int) $r->attemptid] = (int) $r->blurcount;
        }

        $hook->add_html(html_writer::div('', '', [
            'id'             => 'local-focusguard-data',
            'data-counts'    => json_encode($counts),
            'data-threshold' => self::ALERT_THRESHOLD,
            'hidden'         => 'hidden',
        ]));
        $PAGE->requires->js_call_amd('local_focusguard/report', 'init');
    }
}
