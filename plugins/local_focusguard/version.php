<?php
// local_focusguard — señal de integridad por pérdida de foco (Cambio 2, SPECS §2).
defined('MOODLE_INTERNAL') || die();

$plugin->component = 'local_focusguard';
$plugin->version   = 2026071100;      // YYYYMMDDNN
$plugin->requires  = 2024100700;      // Moodle 4.5.0 (Hooks API de output disponible)
$plugin->maturity  = MATURITY_ALPHA;
$plugin->release   = '1.0.0';
