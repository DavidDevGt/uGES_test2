// local_focusguard/report — decora el reporte de intentos del profesor (SPECS §2.2).
// Lee los conteos del data-attribute embebido por el hook PHP (sin AJAX extra) y
// agrega "Focus: N" junto al link de revisión de cada intento; alerta visual si N > umbral.
define([], function() {
    'use strict';

    return {
        init: function() {
            var data = document.getElementById('local-focusguard-data');
            if (!data) {
                return;
            }
            var counts = JSON.parse(data.dataset.counts || '{}');
            var threshold = parseInt(data.dataset.threshold || '3', 10);

            var decorated = {}; // 1 badge por intento: cada fila tiene 2+ links de review (nombre y nota)
            var links = document.querySelectorAll('a[href*="review.php?attempt="]');
            links.forEach(function(link) {
                var match = link.href.match(/attempt=(\d+)/);
                if (!match) {
                    return;
                }
                var attemptId = match[1];
                if (decorated[attemptId]) {
                    return;
                }
                decorated[attemptId] = true;
                // 0 explícito para intentos sin registros: "muestra 0, sin marca" (SPECS §2.3).
                var count = Object.prototype.hasOwnProperty.call(counts, attemptId) ? counts[attemptId] : 0;

                var cell = link.closest('td');
                if (!cell || cell.querySelector('.focusguard-badge')) {
                    return; // Ya decorada (el reporte puede re-renderizar).
                }
                var badge = document.createElement('span');
                badge.className = 'focusguard-badge' + (count > threshold ? ' focusguard-alert' : '');
                badge.dataset.attemptid = attemptId;
                badge.textContent = 'Focus: ' + count;
                cell.appendChild(badge);
            });
        }
    };
});
