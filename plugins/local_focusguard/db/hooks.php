<?php
// Registro de callbacks de la Hooks API (Moodle 4.3+). Sin callbacks legacy de lib.php.
defined('MOODLE_INTERNAL') || die();

$callbacks = [
    [
        'hook'     => \core\hook\output\before_footer_html_generation::class,
        'callback' => \local_focusguard\hook_callbacks::class . '::before_footer',
    ],
];
