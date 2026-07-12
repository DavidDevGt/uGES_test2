<?php
// Hook de salida para el mensaje al estudiante en la revisión del intento.
defined('MOODLE_INTERNAL') || die();

$callbacks = [
    [
        'hook'     => \core\hook\output\before_footer_html_generation::class,
        'callback' => \local_graceguard\hook_callbacks::class . '::before_footer',
    ],
];
