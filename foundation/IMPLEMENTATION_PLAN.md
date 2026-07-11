# Implementación de Cambios Moodle y QA Automatizado

Este documento detalla la arquitectura y el plan de acción técnico tras investigar las APIs de Moodle y las restricciones definidas en `SPECS.md` (específicamente la regla de "No tocar el core").

## Decisiones resueltas (revisión 2026-07-11, tras investigación verificada)

> [!NOTE]
> **Extensión de la vista del profesor (Cambio 2) — APROBADO el enfoque frontend, con ajuste.** Los datos NO se consultan por una segunda llamada AJAX: el callback PHP del hook de footer los embebe como JSON en un data-attribute (una sola query en servidor) y el módulo AMD solo decora el DOM con el badge. Menos latencia y menos flakiness en los tests. *Alternativa evaluada y descartada por costo (~3x boilerplate): subplugin oficial de reporte `quiz_focusguard` (tipo `quiz_`, helpers `attemptsreport.php`) — se documenta en la matriz de decisión para la defensa.*

> [!NOTE]
> **Cálculo de penalización (Cambio 4) — APROBADO.** Modificar `sumgrades` del intento y propagar con la API moderna de mod_quiz (4.2+): `quiz_settings::create($quizid)->get_grade_calculator()->recompute_final_grade($userid)`. `quiz_save_best_grade` es el nombre legacy pre-4.2. Verificar la firma exacta en el entorno y registrar cualquier discrepancia como hallazgo (bonus).

## Proposed Changes

A continuación se detalla la estructura y componentes a generar para la solución.

### Entorno y Datos

- **`compose.yml`**: Configuración de los servicios MariaDB y Moodle. Imagen `erseco/alpine-moodle` pineada a tag de Moodle 4.5 LTS (auto-instala vía env vars, moosh embebido). *`bitnami/moodle` fue retirado del catálogo gratuito de Docker Hub en 2025 (solo queda `bitnamilegacy`, congelada — es el fallback); `moodlehq/moodle-php-apache` no incluye Moodle.*
- **`scripts/seed.sh`**: Script bash idempotente que utilizará `moosh` (embebido en la imagen: `docker compose exec moodle moosh ...`) para poblar categorías, cursos, usuarios, banco de preguntas (los 6 tipos, importados desde `scripts/seed-questions.xml` en formato Moodle XML) y los dos cuestionarios (`quiz-general` y `quiz-timed`). Los huecos que moosh no cubre (matriculaciones — su `course-enrol` es incompatible con 4.5 —, asignar preguntas al quiz y la pregunta aleatoria) los cierra `scripts/seed-course-setup.php` (script CLI contra las APIs `enrol` y `mod_quiz`, ejecutado dentro del contenedor).

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

#### [NEW] `plugins/local_focusguard/db/hooks.php` y `classes/hook_callbacks.php`
Registro y callback del hook `core\hook\output\before_footer_html_generation` (Hooks API, disponible desde Moodle 4.4). El callback comprueba `$PAGE->pagetype`: en la página del intento (`mod-quiz-attempt`) inyecta `main.js` vía `js_call_amd()`; en la vista del reporte de intentos del profesor embebe los conteos como JSON en un data-attribute e inyecta el módulo AMD que decora las filas con el badge. **No usar callbacks legacy de `lib.php`** (`*_before_footer`, `*_extend_navigation`): emiten deprecation warnings desde 4.4.

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
Registrará y manejará el evento `\mod_quiz\event\attempt_submitted`. El observer validará si el intento cayó en el período de gracia — doble señal: `overduehandling = graceperiod` en el quiz + `timefinish > timestart + timelimit` con tolerancia (el estado se almacena explícitamente en `quiz_attempts.state`: `inprogress → overdue → finished`) — y aplicará la reducción sobre `sumgrades`, propagando al gradebook con `\mod_quiz\grade_calculator::recompute_final_grade()`.

#### [NEW] `plugins/local_graceguard/db/hooks.php` y `classes/hook_callbacks.php`
Mismo mecanismo de Hooks API que focusguard: callback sobre `before_footer_html_generation` que, en la página de revisión del intento (`mod-quiz-review`), muestra el desglose de la nota original, penalización y nota final al estudiante (leyendo de `local_graceguard_log`).

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
