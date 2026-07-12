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
];
