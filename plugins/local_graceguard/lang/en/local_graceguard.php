<?php
// Strings de local_graceguard.
defined('MOODLE_INTERNAL') || die();

$string['pluginname'] = 'Grace Guard (grace period penalty)';
$string['enabled'] = 'Enable penalty';
$string['enabled_desc'] = 'When enabled, attempts submitted during the grace period receive a percentage penalty on the attempt grade.';
$string['penaltypct'] = 'Penalty percentage';
$string['penaltypct_desc'] = 'Percentage (0-100) deducted from the attempt grade when it is submitted during the grace period. Default: 10.';
$string['penaltynotice'] = 'This attempt was submitted during the grace period: grade {$a->original} → {$a->penaltypct}% penalty → final grade {$a->final}.';
$string['privacy:metadata:local_graceguard_log'] = 'Audit log of grace period penalties applied to quiz attempts.';
