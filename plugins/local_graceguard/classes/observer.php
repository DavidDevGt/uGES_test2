<?php
namespace local_graceguard;

/**
 * Observer de \mod_quiz\event\attempt_submitted (SPECS §3.2).
 *
 * Detección: el quiz debe tener overduehandling=graceperiod con límite de tiempo,
 * Y el intento debe haber pasado por el estado 'overdue'. Moodle almacena el estado
 * explícito (inprogress → overdue → finished); al recibir este evento ya está
 * finished, así que la señal FIABLE es el evento \mod_quiz\event\attempt_becameoverdue
 * en el log store (hallazgo F20: el delta temporal timefinish-timestart NO distingue
 * un envío en gracia inmediato de un envío normal procesado lento).
 *
 * Idempotencia: la KEY unique sobre attemptid en local_graceguard_log garantiza
 * que un regrade o un evento duplicado no aplique la penalización dos veces.
 */
class observer {

    /** Tolerancia en segundos por latencia entre expiración y persistencia (SPECS §3.2). */
    const TOLERANCE_SECS = 1;

    public static function attempt_submitted(\mod_quiz\event\attempt_submitted $event): void {
        global $DB, $CFG;

        if (!get_config('local_graceguard', 'enabled')) {
            return; // Con el plugin desactivado, comportamiento nativo intacto (SPECS §3.3).
        }

        // Releer de BD (no el snapshot): queremos el estado final post-envío.
        $attempt = $DB->get_record('quiz_attempts', ['id' => $event->objectid]);
        if (!$attempt || $attempt->state !== 'finished' || $attempt->sumgrades === null) {
            return;
        }

        $quiz = $DB->get_record('quiz', ['id' => $attempt->quiz]);
        if (!$quiz || $quiz->overduehandling !== 'graceperiod'
                || (int) $quiz->timelimit <= 0 || (int) $quiz->graceperiod <= 0) {
            return;
        }

        // HALLAZGO F20 (el candidato #1 que SPECS §3.2 predijo): la señal temporal
        // timefinish - timestart NO distingue confiablemente el envío en gracia.
        // Un envío en gracia inmediato mide timelimit+1 (latencia del auto-redirect)
        // y un envío normal procesado lento puede medir timelimit+2. La señal FIABLE
        // es la máquina de estados: si el intento pasó por 'overdue', Moodle emitió
        // \mod_quiz\event\attempt_becameoverdue (persistido en el log store estándar).
        if ($DB->get_manager()->table_exists('logstore_standard_log')) {
            $wasoverdue = $DB->record_exists('logstore_standard_log', [
                'eventname' => '\mod_quiz\event\attempt_becameoverdue',
                'objectid'  => $attempt->id,
            ]);
        } else {
            // Fallback si el log store está deshabilitado: delta temporal estricto.
            $elapsed = (int) $attempt->timefinish - (int) $attempt->timestart;
            $wasoverdue = $elapsed > (int) $quiz->timelimit + self::TOLERANCE_SECS;
        }
        if (!$wasoverdue) {
            return; // Enviado dentro del tiempo normal: intacto (SPECS §3.3).
        }

        // Idempotencia: ya penalizado.
        if ($DB->record_exists('local_graceguard_log', ['attemptid' => $attempt->id])) {
            return;
        }

        $penaltypct = (int) get_config('local_graceguard', 'penaltypct');
        $penaltypct = max(0, min(100, $penaltypct));
        if ($penaltypct === 0) {
            return;
        }

        $original = (float) $attempt->sumgrades;
        $final = round($original * (1 - $penaltypct / 100), 5);

        // Transacción: log + nota del intento + gradebook se aplican completos o
        // ninguno. Si el regrade falla, el rollback restaura sumgrades y el log
        // (sin log, un reintento del evento vuelve a intentar la penalización).
        // La KEY unique sobre attemptid resuelve la carrera concurrente: el
        // perdedor aborta en el insert antes de tocar la nota.
        $transaction = $DB->start_delegated_transaction();
        try {
            $DB->insert_record('local_graceguard_log', (object) [
                'attemptid'      => $attempt->id,
                'userid'         => $attempt->userid,
                'quizid'         => $attempt->quiz,
                'original_grade' => $original,
                'penalty_pct'    => $penaltypct,
                'final_grade'    => $final,
                'timeapplied'    => time(),
            ]);

            $DB->set_field('quiz_attempts', 'sumgrades', $final, ['id' => $attempt->id]);

            // Propagar al gradebook con la API moderna (4.2+); fallback legacy documentado.
            if (class_exists('\mod_quiz\quiz_settings')) {
                \mod_quiz\quiz_settings::create($quiz->id)
                    ->get_grade_calculator()
                    ->recompute_final_grade($attempt->userid);
            } else {
                require_once($CFG->dirroot . '/mod/quiz/locallib.php');
                quiz_save_best_grade($quiz, $attempt->userid);
            }

            $transaction->allow_commit();
        } catch (\Throwable $e) {
            // Rollback y re-lanza: el fallo queda en los logs del event manager
            // en vez de dejar sumgrades y gradebook inconsistentes (revisión M2).
            $transaction->rollback($e);
        }
    }

}
