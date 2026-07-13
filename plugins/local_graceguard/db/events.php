<?php
// Observer sobre el envío de intentos (SPECS §3.2).
defined('MOODLE_INTERNAL') || die();

$observers = [
    [
        'eventname' => '\mod_quiz\event\attempt_submitted',
        'callback'  => '\local_graceguard\observer::attempt_submitted',
        // false: corre tras el commit de la transacción del envío — la penalización
        // y el regrade no compiten con la escritura del intento.
        'internal'  => false,
    ],
    // NOTA F23: el regrade nativo restaura sumgrades SIN penalización. Se intentó
    // re-aplicarla observando attempt_regraded, pero ese evento dispara ANTES de
    // que quiz_update_sumgrades persista la base — cualquier escritura del observer
    // queda aplastada (carrera verificada empíricamente). Limitación documentada en
    // docs/findings.md; el log auditable conserva el desglose original. Candidato
    // natural a extensión (ad-hoc task post-regrade u observer de user_graded).
];
