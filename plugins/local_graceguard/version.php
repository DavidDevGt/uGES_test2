<?php
// local_graceguard — penalización por entrega en período de gracia (Cambio 4, SPECS §3).
defined('MOODLE_INTERNAL') || die();

$plugin->component = 'local_graceguard';
$plugin->version   = 2026071301;      // YYYYMMDDNN — bump F23 (observer de attempt_regraded)
$plugin->requires  = 2024100700;      // Moodle 4.5.0
$plugin->maturity  = MATURITY_ALPHA;
$plugin->release   = '1.0.0';
