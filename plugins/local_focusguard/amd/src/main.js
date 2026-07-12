// local_focusguard/main — tracker de pérdidas de foco durante el intento (SPECS §2.2).
// blur y visibilitychange suelen dispararse juntos por el mismo gesto: debounce de 1s.
// Un fallo del reporte JAMÁS bloquea al estudiante: fail silencioso con log.
define(['core/ajax', 'core/log'], function(Ajax, Log) {
    'use strict';

    var attemptId = 0;
    var debounceTimer = null;
    var DEBOUNCE_MS = 1000;

    function reportBlur() {
        Ajax.call([{
            methodname: 'local_focusguard_report_blur',
            args: {attemptid: attemptId},
            done: function(response) {
                Log.debug('focusguard: blur count = ' + response.count);
            },
            fail: function(err) {
                Log.warn('focusguard: report failed (no bloquea al estudiante)', err);
            }
        }]);
    }

    function onFocusLoss() {
        if (debounceTimer !== null) {
            return;
        }
        debounceTimer = setTimeout(function() {
            debounceTimer = null;
        }, DEBOUNCE_MS);
        reportBlur();
    }

    return {
        /**
         * @param {number} id quiz_attempts.id del intento en curso
         */
        init: function(id) {
            attemptId = id;
            document.addEventListener('visibilitychange', function() {
                if (document.hidden) {
                    onFocusLoss();
                }
            });
            window.addEventListener('blur', onFocusLoss);
            Log.debug('focusguard: init attempt ' + attemptId);
        }
    };
});
