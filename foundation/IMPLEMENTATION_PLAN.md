# Implementación de Cambios Moodle y QA Automatizado

Este documento detalla la arquitectura y el plan de acción técnico tras investigar las APIs de Moodle y las restricciones definidas en `SPECS.md` (específicamente la regla de "No tocar el core").

## User Review Required

> [!IMPORTANT]
> **Extensión de la vista del profesor (Cambio 2)**: Moodle NO provee un "hook" oficial en PHP para añadir columnas de forma limpia al reporte nativo de intentos de cuestionario (`quiz_overview_report`) sin modificar el core. 
> **Propuesta:** Para cumplir con la restricción de "No tocar el core", inyectaremos JavaScript (vía AMD module) en la página del reporte del profesor. Este script identificará las filas de los intentos, consultará nuestro Web Service (o embeberá los datos si los inyectamos en un data-attribute global) y agregará el badge rojo de "Pérdidas de foco: N" modificando el DOM de forma segura. ¿Estás de acuerdo con este enfoque frontend para la extensión del reporte?

> [!WARNING]
> **Cálculo de penalización (Cambio 4)**: Capturar el evento `\mod_quiz\event\attempt_submitted` es el enfoque correcto. Sin embargo, recalcular la calificación en el `gradebook` directamente puede ser frágil.
> **Propuesta:** La lógica modificará el `sumgrades` del intento y luego llamará a la API oficial de calificación del módulo (`quiz_save_best_grade` o equivalente) para asegurar que Moodle propague el cambio al libro de calificaciones correctamente. 

## Proposed Changes

A continuación se detalla la estructura y componentes a generar para la solución.

### Entorno y Datos

- **`docker-compose.yml`**: Configuración de los servicios MariaDB y Moodle (imagen de Bitnami pineada a un tag específico para reproducibilidad).
- **`scripts/seed.sh`**: Script bash idempotente que utilizará `moosh` (Moodle Shell) o Moodle CLI para poblar la base de datos con las categorías, cursos, usuarios, banco de preguntas (los 6 tipos) y los dos cuestionarios configurados (`quiz-general` y `quiz-timed`).

---

### Plugin local_focusguard (Cambio 2)

Implementará la señal de integridad por pérdida de foco.

#### [NEW] `plugins/local_focusguard/version.php` y `lang/en/local_focusguard.php`
Definiciones estándar del plugin.

#### [NEW] `plugins/local_focusguard/db/install.xml`
Creará la tabla `local_focusguard_counts` (`id`, `attemptid`, `userid`, `quizid`, `count`, `timemodified`).

#### [NEW] `plugins/local_focusguard/db/services.php` y `externallib.php`
Definirá el Web Service `local_focusguard_report_blur` para recibir las notificaciones por AJAX de forma asíncrona.

#### [NEW] `plugins/local_focusguard/amd/src/main.js` (y su versión build)
Script inyectado en el lado del cliente con listeners para `visibilitychange` y `blur` (usando debounce). Enviará la petición al Web Service utilizando el módulo `core/ajax` de Moodle.

#### [NEW] `plugins/local_focusguard/lib.php`
Usará el callback `local_focusguard_extend_navigation` (o similar) para inyectar condicionalmente el script `main.js` mediante `$PAGE->requires->js_call_amd()` solo en la página `mod/quiz/attempt.php`. Además, inyectará el script de modificación del reporte en la vista del profesor.

---

### Plugin local_graceguard (Cambio 4)

Implementará la penalización por entrega en período de gracia.

#### [NEW] `plugins/local_graceguard/version.php` y `lang/en/local_graceguard.php`
Definiciones estándar del plugin.

#### [NEW] `plugins/local_graceguard/db/install.xml`
Creará la tabla `local_graceguard_log` para registrar auditoría (`attemptid`, `original_grade`, `penalty_pct`, `final_grade`, `timeapplied`).

#### [NEW] `plugins/local_graceguard/settings.php`
Creará la página de configuración de administrador en Site Administration para habilitar la penalización y configurar el porcentaje (e.g., 10%).

#### [NEW] `plugins/local_graceguard/db/events.php` y `classes/observer.php`
Registrará y manejará el evento `\mod_quiz\event\attempt_submitted`. El observer validará si el intento se realizó en el período de gracia y aplicará la reducción en la nota, llamando a la API de actualización del gradebook.

#### [NEW] `plugins/local_graceguard/lib.php`
Inyectará HTML o un script en la página de revisión del intento (`mod/quiz/review.php`) para mostrar el desglose de la nota original, penalización y nota final al estudiante (leyendo de `local_graceguard_log`).

---

### Suite QA E2E (Playwright)

Automatización completa basada en la especificación.

#### [NEW] `e2e/playwright.config.ts` y `e2e/global-setup.ts`
Configuración base con sharding, roles múltiples (creación de storage states tras login en `global-setup`) e integración con el script de seeding.

#### [NEW] `e2e/fixtures/roles.ts` y `e2e/fixtures/testdata.ts`
Implementación de fixtures para usar contextos autenticados de forma sencilla (`asAdmin`, `asTeacher`, `asStudent`) sin repetir flujos de login.

#### [NEW] `e2e/pages/*.ts` (Page Objects)
Abstracción de la UI para aislar los tests de los cambios visuales de Moodle. (e.g., `QuizAttemptPage`, `GradingPage`, `AttemptsReportPage`).

#### [NEW] `e2e/specs/*.spec.ts`
Implementación de las pruebas para los 12 flujos funcionales descritos y la cobertura de los Cambios 2 y 4, priorizando asserts sobre elementos funcionales reales y utilizando el `test.slow()` apropiadamente en flujos de límite de tiempo.

## Verification Plan

### Automated Tests
Ejecución completa de la suite de Playwright. Se validará que:
- Los flujos 1-12 de Moodle corren en verde.
- El Cambio 2 registra los conteos correctamente y dibuja el badge al exceder 3 desenfoques (en el reporte del profesor).
- El Cambio 4 penaliza exclusivamente intentos enviados después del límite (validando el log, UI de revisión y Gradebook).

Comandos:
- `docker compose up -d`
- `./scripts/seed.sh`
- `npx playwright test`

### Manual Verification
1. Verificación del despliegue en limpio (partiendo de cero con el repositorio).
2. Revisión exhaustiva de `docs/ai-direction/` para asegurar que el protocolo de generación haya quedado correctamente evidenciado.
3. Validación visual de mensajes en pantalla introducidos por `local_focusguard` y `local_graceguard` para asegurar coherencia UX/UI.
