# Hallazgos: discrepancias entre documentación y comportamiento real

> Bitácora del bonus del enunciado. Cada entrada: qué decía la documentación / qué se esperaba, qué pasó de verdad, evidencia y cómo se resolvió. Fuente cruda del doc de decisiones (`decisions-and-ai-direction.md`).

## 2026-07-11 — Montaje del entorno y seeding

### F1 — `bitnami/moodle` ya no existe en el catálogo gratuito de Docker Hub
- **Esperado (SPECS v1):** usar `bitnami/moodle` pineada.
- **Real:** Broadcom retiró las imágenes gratuitas de Bitnami (2025); solo queda `bitnamilegacy/` congelada. `moodlehq/moodle-php-apache` tampoco sirve como reemplazo directo: no contiene Moodle.
- **Resolución:** decisión D5 en SPECS — `erseco/alpine-moodle:v4.5.12` (auto-instala por env vars, moosh embebido).

### F2 — El instalador de la imagen rompe con espacios en `MOODLE_SITENAME`
- **Esperado:** `MOODLE_SITENAME=QA-EXAMS Lab` como cualquier env var.
- **Real:** el entrypoint pasa el valor sin comillas al CLI de instalación de Moodle → `Unrecognised options: Lab` y crash-loop del contenedor.
- **Resolución:** sitename sin espacios (`QA-EXAMS-Lab`) + nota en `.env.example`.

### F3 — Moodle exige UTF-8 y el default de MariaDB 11.4 no lo es para bases nuevas
- **Real:** el instalador aborta con `!! unicode !!` si la BD no tiene charset UTF-8 por defecto.
- **Resolución:** `command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci` en el servicio mariadb.

### F4 — Healthcheck: `localhost` + `wget --spider` fallan por partida doble dentro del contenedor
- **Real (a):** en Alpine, `localhost` resuelve primero a `::1` y el nginx de la imagen solo escucha IPv4 → connection refused aunque el servicio esté vivo.
- **Real (b):** `/login/index.php` responde **303** hacia `$CFG->wwwroot` (que apunta a `localhost` del host) → wget sigue el redirect y vuelve a fallar.
- **Resolución:** `curl -fsS http://127.0.0.1:8080/...` — IP explícita, sin seguir redirects, y `-f` acepta 3xx.

### F5 — `moosh course-enrol` es incompatible con Moodle 4.5
- **Real:** pierde `$CFG->dirroot` al disparar la notificación de matrícula (`Undefined property: stdClass::$dirroot` en cascada) y aborta.
- **Resolución:** matriculaciones vía API oficial (`enrol_try_internal_enrol`) en `scripts/seed-course-setup.php`.

### F6 — `moosh questioncategory-create` crea la categoría con `parent=0`
- **Real:** no la cuelga de la categoría `top` del contexto, así que el banco de preguntas de la UI no la muestra.
- **Resolución:** reparentado vía `question_get_top_category($contextid, true)` en el script PHP.

### F7 — Git Bash (Windows) reescribe los paths absolutos que van al contenedor
- **Real:** MSYS convierte `/tmp/seed-questions.xml` en `C:/Users/.../Temp/...` al pasarlo como argumento de `docker compose exec` → moosh busca `/opt/moosh/C:/Users/...`.
- **Resolución:** `export MSYS_NO_PATHCONV=1` en los scripts (no-op en Linux/macOS). Relevante para evaluadores en Windows.

## 2026-07-11 — Configuración de la suite Playwright

### F9 — BOM UTF-8 en `package.json` rompe pnpm
- **Real:** el archivo (generado desde un editor Windows) empezaba con `EF BB BF`; JSON no admite BOM y pnpm aborta con `Invalid package.json`.
- **Resolución:** reescrito sin BOM; `.gitattributes` ya fuerza LF para archivos de texto.

### F10 — Los user tours de Moodle bloquean el primer login automatizado
- **Real:** en el primer login de cada usuario, Moodle 4.5 muestra el diálogo de onboarding del block drawer ("Expand to explore"), que intercepta la página y rompe los asserts post-login.
- **Resolución:** `UPDATE mdl_tool_usertours_tours SET enabled=0` como paso de endurecimiento en `seed.sh` (elimina además una fuente de flakiness para toda la suite).

### F11 — `#usermenu` ya no existe en Boost 4.5
- **Real:** el id clásico del menú de usuario cambió; en 4.5 el toggle es `a#user-menu-toggle` (verificado inspeccionando el DOM vivo).
- **Resolución:** selector actualizado en `LoginPage.ts`, encapsulado en el Page Object con nota.

## 2026-07-12 — Escritura del spec 04 (flujos 6, 8, 9)

### F14 — La pregunta aleatoria excluye las preguntas ya usadas en slots fijos del mismo quiz
- **Real:** con las 6 SEED fijas en quiz-general, el slot aleatorio tenía pool CERO y el intento no podía iniciarse: "There are not enough questions in category 1 to create the question Random question (7)". No documentado en la spec del seeding.
- **Resolución:** pool de reserva `seed-questions-extra.xml` (SEED-MC-02/SEED-TF-02) que nunca van fijas; verify-env pasa de 6 a 8 preguntas.

### F15 — El `quiz-delete-attempts` de moosh embebido no soporta filtro de usuario
- **Real:** la documentación de moosh lista `[-u userid]`; el binario embebido responde "Invalid option: -u". Sin filtro por usuario, un reset borra los intentos en vuelo de otros specs paralelos.
- **Resolución:** `reset-attempts.sh` reescrito sobre la API oficial `quiz_delete_attempt()` (limpia question usages y recalcula grades), con filtro (quiz, usuario) y sin `|| true` que trague errores.

### F16 — Las respuestas del intento solo se persisten al navegar (o autosave de 60s)
- **Real:** marcar un radio y cerrar la página sin navegar pierde la respuesta (el slot queda `gaveup` — verificado en `question_attempt_steps`). El submit del form ocurre al cambiar de página.
- **Implicación E2E:** todo test que responda una pregunta debe navegar después (o el assert de nota fallará con -1 punto exacto, como nos pasó: 3.00 en vez de 4.00).

### F17 — Un ensayo RESPONDIDO retiene la nota de todo el intento ("Not yet graded")
- **Real:** si el ensayo tiene respuesta, la nota del intento completo queda "Not yet graded" hasta calificación manual — el flujo 9 (nota automática exacta) es imposible con ensayo respondido. Un ensayo SIN responder pasa a `gaveup` (0 automático) y el resto sí se califica.
- **Implicación:** el spec 04 deja el ensayo en blanco (0 determinista, nota exacta 4.00/7.00 verificada); responder+calificar el ensayo es el flujo 10 (spec 06) con su propio par (quiz, usuario).

### F18 — Selectores accesibles reales de Boost 4.5 (varios ≠ markup clásico)
- Las opciones multichoice/truefalse NO usan `<label>`: el accessible name vive en el propio radio ("a. París").
- El botón de flag expone como accessible name el ESTADO ("Flagged"), no el texto visible ("Flag question").
- El panel de navegación del intento vive en el block drawer, colapsado por defecto (los `#quiznavbuttonN` existen pero no son visibles).
- La página del curso del profesor tiene DOS links "Grades" (navegación + user menu): strict mode los rechaza — el gradebook se abre por URL directa `grade/report/grader/index.php?id=courseid`.
- La fila del intento en la vista del quiz es una tabla con caption "Attempt N summary"; el label del timestamp es "Completed", no "Submitted".

## 2026-07-12 — Depuración del CI (suite roja solo en GitHub Actions)

### F13 — `core/togglesensitive` de Moodle 4.5 borra el password tecleado durante su init
- **Síntoma:** los 4 logins del setup fallaban con "Invalid login" SOLO en CI; en local siempre verde. El trace de Playwright reveló el POST real: `username=admin&password=` — **password vacío** pese al `fill()`.
- **Causa raíz (leída en `lib/amd/src/togglesensitive.js`):** `init("password", 1)` corre incondicionalmente en la página de login, captura `sensitiveInput.outerHTML` (que no serializa el valor tecleado), renderiza su template **asíncronamente** y al resolver hace `sensitiveInput.outerHTML = html` — **reemplaza el input entero, descartando lo tecleado en la ventana**. En CI (caches fríos, primer request del template en la vida del sitio) esa ventana dura lo suficiente para tragarse el fill; en local el template resuelve antes.
- **Nota:** esto afecta también a humanos que tecleen rápido en conexiones lentas — candidato a reporte upstream a Moodle.
- **Resolución (`LoginPage.ts`):** espera estilo Behat sobre `M.util.pending_js` (la señal oficial de "Moodle terminó su JS", que `togglesensitive` alimenta vía `core/pending`) antes de llenar + verificación `toHaveValue` con reintento como segunda capa. Cero sleeps fijos.
- **Cómo se diagnosticó:** artefactos del run fallido (`gh run download`) → aria snapshot con el alert "Invalid login" → POST body extraído del `trace.zip` (recurso por sha1) → fuente del módulo en el contenedor. Reproducido el contexto con instalación fresca local (`down -v`): las credenciales autentican por API (`bool(true)`) — confirmando que era UI race, no datos.

## 2026-07-11 — Instalación de los plugins

### F12 — El entrypoint de `erseco/alpine-moodle` corre `upgrade.php` en cada arranque
- **Real:** al recrear el contenedor con los plugins montados en `local/`, el entrypoint los instaló automáticamente (por eso `admin/cli/upgrade.php` manual respondía "No upgrade needed" — ya estaban en BD). El paso explícito de `seed.sh` queda como cinturón y tirantes para el caso "montar plugins sin recrear el contenedor".
- **Implicación:** los settings de admin reciben sus defaults en esa instalación automática (verificado: `enabled=1`, `penaltypct=10`).

### F8 — Contexto CLI de Moodle: sin `$USER` no hay pregunta aleatoria
- **Real:** `quiz_add_random_questions()` valida la capability `useall` contra el usuario de sesión; en CLI no hay sesión → "Sorry, but you do not currently have permissions".
- **Resolución:** `\core\session\manager::set_user(get_admin())` + `$CFG->noemailever = true` al inicio del script CLI (lo segundo evita el error de `email_to_user` con SMTP sin configurar).
