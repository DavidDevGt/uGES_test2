<?php
// Web service AJAX para reportar pérdidas de foco (SPECS §2.2).
defined('MOODLE_INTERNAL') || die();

$functions = [
    'local_focusguard_report_blur' => [
        'classname'     => 'local_focusguard\external\report_blur',
        'methodname'    => 'execute',
        'description'   => 'Reports a focus loss event for a quiz attempt owned by the current user.',
        'type'          => 'write',
        'ajax'          => true,   // Llamable desde core/ajax con la sesión (sesskey lo maneja el framework).
        'loginrequired' => true,
    ],
];
