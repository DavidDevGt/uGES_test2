<?php
// Settings de admin (SPECS §3.2): toggle + porcentaje configurable, default 10%.
defined('MOODLE_INTERNAL') || die();

if ($hassiteconfig) {
    $settings = new admin_settingpage(
        'local_graceguard',
        get_string('pluginname', 'local_graceguard')
    );

    $settings->add(new admin_setting_configcheckbox(
        'local_graceguard/enabled',
        get_string('enabled', 'local_graceguard'),
        get_string('enabled_desc', 'local_graceguard'),
        1
    ));

    $settings->add(new admin_setting_configtext(
        'local_graceguard/penaltypct',
        get_string('penaltypct', 'local_graceguard'),
        get_string('penaltypct_desc', 'local_graceguard'),
        10,
        PARAM_INT
    ));

    $ADMIN->add('localplugins', $settings);
}
