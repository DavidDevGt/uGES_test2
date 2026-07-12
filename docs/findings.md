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

## 2026-07-11 — Instalación de los plugins

### F12 — El entrypoint de `erseco/alpine-moodle` corre `upgrade.php` en cada arranque
- **Real:** al recrear el contenedor con los plugins montados en `local/`, el entrypoint los instaló automáticamente (por eso `admin/cli/upgrade.php` manual respondía "No upgrade needed" — ya estaban en BD). El paso explícito de `seed.sh` queda como cinturón y tirantes para el caso "montar plugins sin recrear el contenedor".
- **Implicación:** los settings de admin reciben sus defaults en esa instalación automática (verificado: `enabled=1`, `penaltypct=10`).

### F8 — Contexto CLI de Moodle: sin `$USER` no hay pregunta aleatoria
- **Real:** `quiz_add_random_questions()` valida la capability `useall` contra el usuario de sesión; en CLI no hay sesión → "Sorry, but you do not currently have permissions".
- **Resolución:** `\core\session\manager::set_user(get_admin())` + `$CFG->noemailever = true` al inicio del script CLI (lo segundo evita el error de `email_to_user` con SMTP sin configurar).
