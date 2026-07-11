# SPECS.md — Prueba Técnica 2: especificaciones funcionales y técnicas

> Documento fuente para **dirigir la generación de código con IA** (spec-driven). Cada sección es una unidad de generación: se le entrega a la IA con su contexto, se revisa el output contra los criterios de aceptación, y las desviaciones se corrigen editando la spec o rechazando el código — nunca parchando a mano sin registrar.
> Scope: entorno reproducible · automatización del QA del módulo de exámenes (alcance completo) y los cambios restantes (Cambio 2 y Cambio 4).

---

## 0. Decisiones de arquitectura (con sus matrices)

### D1 — Framework de la suite: **Playwright + TypeScript** (vs. Behat, Cypress, Selenium)

| Criterio | Behat (nativo Moodle) | Selenium+Java | Cypress | **Playwright+TS** |
|---|---|---|---|---|
| Velocidad / paralelización | Lento, secuencial | Media | Media (paralelo de pago) | **Alta, sharding nativo** |
| Evidencia por corrida | Logs | Screenshots manuales | Videos | **Traces + video + screenshots nativos** |
| Multi-rol simultáneo (profesor+estudiante) | Difícil | Manual | Limitado (multi-origin) | **Contexts aislados nativos** |
| Lenguaje del equipo GES | PHP | Java | JS | **TypeScript (valorado en la JD)** |
| Manejo de timers/espera | Pobre | Manual | Bueno | **Web-first assertions + clock** |
| Setup para evaluadores | Requiere toolchain PHP de Moodle | Pesado | Medio | **`npm i && npx playwright install`** |

**Decisión:** Playwright. Behat queda documentado como alternativa evaluada — mencionable en la defensa como conocimiento del ecosistema Moodle.

### D2 — Capa de implementación de los cambios: **plugins `local_` + hooks estándar** (sin tocar core)
- Cambio 2: plugin `local_focusguard` (JS inyectado vía Hooks API — `db/hooks.php` + callback sobre `core\hook\output\before_footer_html_generation` — condicionado a la página del intento + web service AJAX + tabla propia + inyección en la vista de revisión de intentos). *Nota verificada: los callbacks legacy `*_before_footer` en `lib.php` emiten deprecation warnings desde Moodle 4.4 — no usarlos.*
- Cambio 4: plugin `local_graceguard` (event observer sobre `\mod_quiz\event\attempt_submitted` + settings de admin + regrade del intento + notificación visible al estudiante).
- *Racional:* los plugins locales sobreviven upgrades de Moodle, se instalan/desinstalan limpio, y son "la capa razonable" que el enunciado evalúa. Alternativas descartadas: modificar `mod_quiz` (prohibido: core), tema custom (frágil), fork (insostenible).

### D3 — Seeding: **script bash + moosh/CLI de Moodle**, idempotente
- Alternativas: clicks manuales (prohibido por criterio propio: eso es el "humo"), backup/restore de curso (opaco, no versionable), web services (más código para el mismo resultado). moosh/CLI es explícito, versionable y legible en el repo.

### D4 — Datos de prueba con timers cortos
- El seeding crea DOS exámenes: `quiz-general` (sin límite, para flujos funcionales) y `quiz-timed` (límite 2 min + gracia 1 min + penalización activa, para flujos 7 y Cambio 4). Los tests de timer son los únicos lentos; el resto no espera relojes.
- *Nota:* el admin setting `quiz | graceperiodmin` impone un mínimo de 60 s de gracia — el `quiz-timed` queda exactamente en el mínimo; si el envío manual dentro de la gracia resulta demasiado justo en los tests, subirla a 2 min.

### D5 — Versión de Moodle e imagen: **Moodle 4.5 LTS en `erseco/alpine-moodle`** (vs. 5.x / Bitnami / moodlehq)

| Criterio | Moodle 5.x (`latest`) | Bitnami | moodlehq/moodle-php-apache | **erseco/alpine-moodle @ v4.5.x** |
|---|---|---|---|---|
| Disponibilidad 2026 | OK | **Retirada del catálogo gratuito (Broadcom, 2025); solo `bitnamilegacy` congelada** | OK | **OK, mantenida activamente** |
| Contiene Moodle + auto-install | — | Sí (congelado) | **No — solo PHP+Apache** | **Sí, 100% por env vars** |
| Hooks API de salida (Cambio 2) | Sí | Según tag | Según código montado | **Sí (desde 4.4)** |
| Estabilidad estructural | 5.1 movió el webroot a `public/` | — | — | **Estructura clásica, LTS hasta 2027** |
| Tooling de seeding | — | — | — | **moosh embebido en la imagen** |

**Decisión:** `erseco/alpine-moodle` pineada al último tag `v4.5.x` (LTS). Cumple "3 comandos reales" (auto-instala en el primer arranque) y abarata D3 (moosh dentro del contenedor). Fallback documentado: `bitnamilegacy/moodle` pineada (funcional pero sin actualizaciones).

---

## 1. Entorno reproducible

### 1.1 `compose.yml`
- Servicios: `mariadb` + `moodle` (imagen `erseco/alpine-moodle` pineada a tag de Moodle 4.5 LTS — ver D5; auto-instala en el primer arranque vía variables de entorno e incluye moosh), volúmenes nombrados, healthchecks en ambos.
- Variables en `.env.example` (usuario admin, passwords de prueba, puerto). Nada hardcodeado en los tests: leen `.env`.
- `SITE_URL` debe coincidir con el puerto expuesto (`http://localhost:8080`): la instalación lo fija como `$CFG->wwwroot` y no se puede cambiar solo remapeando el puerto.

### 1.2 `scripts/seed.sh` — criterios de aceptación
- [ ] Idempotente: correrlo dos veces no duplica ni falla.
- [ ] Crea: categoría + curso `QA-EXAMS-101`; usuarios `admin` (existente), `teacher1`, `student1`, `student2` con roles correctos; matriculaciones.
- [ ] Banco de preguntas: 1 de cada tipo requerido — opción múltiple, V/F, respuesta corta, numérica, emparejamiento, ensayo (6 preguntas mínimo, nombradas con prefijo `SEED-`).
- [ ] Exámenes: `quiz-general` (preguntas fijas + 1 aleatoria de la categoría) y `quiz-timed` (límite 2 min, gracia 1 min, 2 intentos permitidos, método de calificación: nota más alta).
- [ ] Instala y habilita los plugins `local_focusguard` y `local_graceguard` (via `php admin/cli/upgrade.php`).
- [ ] Termina imprimiendo un resumen verificable (ids creados) y exit code correcto.

**Mapeo a comandos moosh (embebido en la imagen — se ejecuta con `docker compose exec moodle moosh ...`):** categoría/curso → `category-create` + `course-create` · usuarios/matrícula → `user-create` + `course-enrol` · categoría de preguntas → `questioncategory-create --reuse` (da la idempotencia gratis) · banco → `questionbank-import` con un único archivo Moodle XML versionado (`scripts/seed-questions.xml`, las 6 preguntas `SEED-*`) · quizzes → `activity-add quiz` + `activity-config-set` (timelimit, graceperiod, overduehandling, attempts, grademethod) · limpieza (`reset-attempts.sh`) → `quiz-delete-attempts`. **Huecos que moosh no cubre:** matriculaciones (su `course-enrol` es incompatible con 4.5 — pierde `$CFG->dirroot`), asignar preguntas del banco al quiz y la pregunta aleatoria → script PHP CLI (`scripts/seed-course-setup.php`, contra las APIs `enrol` y `mod_quiz`) ejecutado dentro del contenedor.

---

## 2. Cambio 2 — `local_focusguard` (señal de integridad por pérdida de foco)

### 2.1 Comportamiento (funcional)
1. Mientras un estudiante rinde un intento, cada vez que la ventana/pestaña del examen **pierde el foco** se registra un evento.
2. El conteo se persiste **por intento** (sobrevive recarga de página y navegación entre páginas del examen).
3. En la vista del profesor de revisión de intentos, cada intento muestra su **conteo de pérdidas de foco**; los intentos con **conteo > 3** se marcan visualmente (badge/resaltado).
4. **No afecta la nota.** Es señal informativa.

### 2.2 Diseño técnico
- **Captura (JS, AMD module):** listeners `visibilitychange` (document.hidden) y `window.blur`, con **debounce de 1s** para no contar doble el mismo gesto (blur+visibilitychange suelen dispararse juntos). Solo activo en páginas `mod/quiz/attempt.php` (el callback del hook comprueba `$PAGE->pagetype` antes de `js_call_amd()`). Envío por `core/ajax` al web service propio; buffer con reintento simple si la llamada falla (no bloquea al estudiante jamás).
- **Persistencia:** tabla `local_focusguard_counts` → `id, attemptid (FK, unique), userid, quizid, count, timemodified`. Upsert por attemptid.
- **Web service:** función externa `local_focusguard_report_blur(attemptid)` — valida que el intento pertenece al usuario de la sesión y está `inprogress`; incrementa y devuelve el conteo. Capability: estudiante autenticado dueño del intento.
- **Vista profesor:** el mismo hook de footer, en la página del reporte de intentos, embebe los conteos como JSON en un data-attribute (una sola query en servidor) y un módulo AMD decora las filas mostrando `Focus: N` con clase CSS `focusguard-alert` cuando `N > 3` — sin segunda llamada AJAX (menos latencia y menos flakiness en los tests). Umbral 3 hardcodeado según enunciado (nota de diseño: parametrizable — candidato natural a quinto cambio). *Alternativa evaluada:* subplugin oficial de reporte `quiz_focusguard` (tipo `quiz_`, helpers de `attemptsreport.php` — columna nativa ordenable, cero fragilidad DOM) — descartado por ~3x más boilerplate frente al presupuesto de tiempo; documentado para la defensa.

### 2.3 Criterios de aceptación (los tests verifican esto)
- [ ] Cambiar de pestaña 2 veces durante un intento → la vista del profesor muestra conteo 2, sin marca visual.
- [ ] 4 pérdidas de foco → conteo 4 **con** marca visual.
- [ ] El conteo persiste si el estudiante recarga la página del intento a mitad de examen.
- [ ] Intento sin pérdidas de foco → muestra 0, sin marca.
- [ ] La nota del intento es idéntica con y sin pérdidas de foco (no afecta calificación).
- [ ] Un estudiante no puede reportar blur sobre un intento ajeno (web service rechaza).

---

## 3. Cambio 4 — `local_graceguard` (penalización por entrega en período de gracia)

### 3.1 Comportamiento (funcional)
1. Setup nativo: examen con límite de tiempo y `overduehandling = graceperiod` (esto es configuración, no desarrollo).
2. Si un intento se **envía dentro del período de gracia** (después de expirar el tiempo, antes del fin de la gracia), la nota de **ese intento** recibe una **penalización porcentual configurable** por el admin (default 10%).
3. El estudiante **ve** la penalización aplicada (mensaje en la página de revisión del intento: nota original, penalización, nota final).
4. La nota penalizada **se refleja en el gradebook**.
5. Intentos enviados dentro del tiempo normal: intactos.

### 3.2 Diseño técnico
- **Detección:** event observer sobre `\mod_quiz\event\attempt_submitted`. Moodle almacena el estado explícitamente en `quiz_attempts.state` (máquina: `inprogress → overdue → finished`; durante la gracia el intento está en `overdue` y el estudiante solo puede ir al resumen y enviar). Un intento cayó en gracia si el quiz tiene `overduehandling = graceperiod` Y se cumple la señal temporal `timefinish > timestart + timelimit` (con tolerancia de 1–2 s por latencia); al recibir el evento, leer el registro del intento y contrastar ambas señales. *Verificar contra el comportamiento real de Moodle en el entorno — los campos exactos del attempt son candidato #1 a "discrepancia documentación vs. realidad" (bonus del enunciado): documentar lo que se encuentre.*
- **Aplicación:** recalcular `sumgrades` del intento aplicando el factor `(1 - penalty/100)`, persistir, y disparar el recálculo de la nota del quiz en gradebook con la API moderna (4.2+): `quiz_settings::create($quizid)->get_grade_calculator()->recompute_final_grade($userid)` — `quiz_save_best_grade` es el nombre legacy pre-4.2 (verificar firma exacta en el entorno; anotar discrepancias como hallazgo). Registrar en tabla propia `local_graceguard_log` → `attemptid, original_grade, penalty_pct, final_grade, timeapplied` (auditable, y es la fuente del mensaje al estudiante).
- **Settings de admin:** `local_graceguard/penaltypct` (int 0–100, default 10) + toggle de activación.
- **Mensaje al estudiante:** en la página de revisión del intento, bloque visible: "Tu intento se envió en el período de gracia: nota 8.5 → penalización 10% → nota final 7.65".
- **Idempotencia:** el observer no aplica dos veces sobre el mismo attemptid (check contra el log).

### 3.3 Criterios de aceptación
- [ ] Intento enviado en tiempo normal → nota sin penalización, sin mensaje.
- [ ] Intento auto-enviado en gracia → nota del intento reducida en el % configurado, visible en revisión con el desglose.
- [ ] Gradebook refleja la nota penalizada (assert contra el reporte de calificaciones, no contra la UI del quiz solamente).
- [ ] Cambiar el % en settings (10 → 25) cambia la penalización de los intentos siguientes, no de los pasados.
- [ ] Recalificar el intento no duplica la penalización.
- [ ] Con el plugin desactivado, el comportamiento nativo queda intacto.

---

## 4. Suite QA — arquitectura

### 4.1 Estructura del repo
```
/
├── compose.yml · .env.example
├── plugins/
│   ├── local_focusguard/            # instalables por seed.sh
│   └── local_graceguard/
├── scripts/
│   ├── seed.sh                      # datos base idempotentes (moosh)
│   ├── seed-questions.xml           # banco de preguntas SEED-* (Moodle XML, 6 tipos)
│   ├── seed-course-setup.php        # matriculaciones (API enrol) + preguntas fijas y aleatoria al quiz (API mod_quiz)
│   └── reset-attempts.sh            # limpieza entre corridas (moosh quiz-delete-attempts; borra intentos, no la config)
├── e2e/
│   ├── playwright.config.ts         # projects: setup → teacher-flows → student-flows → grading-flows → changes
│   ├── global-setup.ts              # espera healthcheck, corre seed, guarda storageState por rol
│   ├── fixtures/
│   │   ├── roles.ts                 # contexts autenticados: asAdmin, asTeacher, asStudent
│   │   └── testdata.ts              # ids/nombres sembrados (SEED-*), lee .env
│   ├── pages/                       # Page Objects
│   │   ├── QuizSettingsPage.ts · QuestionBankPage.ts · QuizAttemptPage.ts
│   │   ├── GradingPage.ts · ReviewOptionsPage.ts · GradebookPage.ts · AttemptsReportPage.ts
│   └── specs/
│       ├── 01-quiz-configuration.spec.ts        # flujos 1, 4
│       ├── 02-question-bank.spec.ts             # flujos 2, 3
│       ├── 03-teacher-preview.spec.ts           # flujo 5
│       ├── 04-student-attempt.spec.ts           # flujos 6, 8, 9
│       ├── 05-timer-autosubmit.spec.ts          # flujo 7  (usa quiz-timed)
│       ├── 06-manual-grading-regrade.spec.ts    # flujo 10
│       ├── 07-overrides-reports.spec.ts         # flujo 11
│       ├── 08-access-restrictions.spec.ts       # flujo 12
│       ├── 09-change2-focusguard.spec.ts        # Cambio 2
│       └── 10-change4-graceguard.spec.ts        # Cambio 4
├── docs/
│   ├── 40h-to-2h.md · coverage-report.md
│   ├── decisions-and-ai-direction.md
│   ├── ai-direction/                # evidencia cruda: specs dadas a la IA, correcciones, hallazgos
│   └── evidence/                    # reporte HTML + traces de una corrida real
└── .github/workflows/e2e.yml        # CI
```

### 4.2 Reglas de la suite (calidad anti-flaky)
- **Selectores:** por rol/label accesible (`getByRole`, `getByLabel`) > data-attrs > texto. Clases CSS de Moodle solo como último recurso y encapsuladas en el Page Object.
- **Cero sleeps fijos.** Web-first assertions (`await expect(locator).toHaveText(...)`) con timeout por defecto; `test.slow()` únicamente en `05-timer-autosubmit` y `10-change4` donde el timer real ES el sujeto de la prueba.
- **Aislamiento:** cada spec crea o resetea sus intentos vía `reset-attempts.sh`/API; ningún test depende del orden de otro. `fullyParallel` activado salvo los specs de timer (project serial propio).
- **Multi-rol en un mismo test** (p. ej. estudiante rinde → profesor califica): dos browser contexts con storageState distinto en el mismo spec — nada de logout/login por UI.
- **Evidencia:** `trace: 'retain-on-failure'`, video y screenshot on-failure; reporte HTML publicado como artefacto en cada corrida de CI.
- **Asserts de verdad, por capa:** el flujo 9 no verifica "aparece un número": verifica que la calificación automática del intento con respuestas conocidas es exactamente la esperada Y que el gradebook la refleja.

### 4.3 Matriz scope → spec → assert clave (esqueleto del coverage-report)

| Flujo | Spec | Assert clave (comportamiento real) |
|---|---|---|
| 1 Crear/configurar examen | 01 | El quiz creado persiste timing/intentos/método al reabrir settings |
| 2 Banco: 6 tipos de pregunta | 02 | Cada tipo se crea y aparece listado con su tipo correcto |
| 3 Agregar del banco + aleatorias | 02 | El quiz lista N preguntas; la aleatoria muestra pregunta distinta entre 2 previews (o se documenta la semilla) |
| 4 Opciones de revisión | 01 | Con "respuestas correctas" oculto hasta cierre, el estudiante NO las ve tras enviar; tras cerrar el quiz, SÍ |
| 5 Vista previa profesor | 03 | El profesor completa una preview y ve resultado sin generar intento de estudiante |
| 6 Iniciar/responder/navegar/marcar | 04 | Navegación conserva respuestas; la marca "para revisar" aparece en el panel de navegación |
| 7 Límite de tiempo y auto-envío | 05 | Con timer 2 min expirado, el intento queda `finished` sin acción del estudiante y la nota existe |
| 8 Enviar intento | 04 | Confirmación de envío → estado del intento "Finalizado" con timestamp |
| 9 Calificación automática | 04 | Respuestas conocidas (2 correctas, 1 incorrecta) → nota exacta esperada en revisión Y en gradebook |
| 10 Calificar ensayo / recalificar | 06 | Profesor asigna nota manual al ensayo → la nota total del intento se actualiza; regrade no la corrompe |
| 11 Overrides y reportes | 07 | Override de nota visible en gradebook; reporte de intentos lista los intentos con sus estados |
| 12 Restricciones (contraseña/fechas) | 08 | Sin contraseña no se puede iniciar; con contraseña sí; fuera de ventana de fechas el intento no está disponible |
| Cambio 2 | 09 | Criterios de aceptación §2.3 completos |
| Cambio 4 | 10 | Criterios de aceptación §3.3 completos |

**Candidatos a exclusión justificada** (declarar en coverage-report con plan manual): validación visual fina del marcado (>3) en múltiples temas gráficos de Moodle (se automatiza en el tema por defecto; otros temas = revisión visual trimestral), y arrastre drag&drop de emparejamiento en móvil (se cubre en desktop; móvil = smoke manual).

### 4.4 CI (`.github/workflows/e2e.yml`)
- Jobs: levantar servicios (compose) → healthcheck → seed → `npx playwright test` → publicar reporte HTML + traces como artifacts.
- Triggers: `push` a main, `pull_request`, y `workflow_dispatch` (para la demo en vivo: dispararlo frente a ellos).
- Presupuesto de tiempo: suite completa < 15 min (paralelizada; solo los specs de timer son lentos por naturaleza).

---

## 5. Dirección de IA — protocolo de trabajo (se documenta mientras ocurre)

1. **Unidad de generación = sección de este documento.** A la IA se le entrega la sección + contexto del repo, nunca "hazme un plugin de Moodle".
2. **Revisión del output contra checklist fija:** ¿respeta la capa (no toca core)? ¿APIs de Moodle correctas para la versión del entorno? ¿maneja el caso de fallo? ¿es testeable? ¿algo que no pedí? (el código no solicitado se elimina y se registra).
3. **Registro por componente en `docs/ai-direction/`:** spec entregada → desviaciones del output → corrección aplicada (re-prompt o edición de spec) → cómo se validó (test, corrida manual, lectura línea a línea).
4. **Delegado a la IA:** boilerplate de plugin (estructura de archivos, version.php, lang strings), page objects repetitivos, conversión de criterios de aceptación a specs de Playwright.
   **Decidido por mí:** arquitectura y capas (D1–D4), diseño de los criterios de aceptación, umbrales y trade-offs, qué es assert real vs. humo, y el veredicto final sobre cada línea que entra al repo.
5. **Hallazgos (bonus):** toda discrepancia entre docs de Moodle y comportamiento real del entorno (campos del attempt en gracia, hooks disponibles según versión, comportamiento del regrade) se registra con evidencia — es criterio de evaluación explícito.