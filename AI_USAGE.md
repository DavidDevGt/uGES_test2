# AI_USAGE.md — Dirección de IA

Formato comprometido en `foundation/PLAN.md` §1.4: herramienta → actividad → qué se delegó → cómo se validó.

## Herramientas y modelos

| Herramienta / modelo | Rol |
|---|---|
| Claude Code con Claude Fable 5 | Modelo principal: investigación verificada contra fuentes primarias, generación de infraestructura y scripts, depuración en vivo del entorno, documentación |
| Antigravity (Claude Sonnet 4.6 con Thinking) | Planificación inicial (SPECS/PLAN/TASKS), ediciones de docs, migración npm→pnpm, `package.json` |
| moosh (CLI embebido en la imagen) | No es IA, pero es la herramienta que la IA dirige dentro del contenedor para el seeding |

## Tabla de uso

| Herramienta | Actividad | Qué se delegó | Cómo se validó |
|---|---|---|---|
| Antigravity | Documentos fundacionales (`SPECS.md`, `PLAN.md`, `IMPLEMENTATION_PLAN.md`, `TASKS.md`) | Redacción spec-driven de la arquitectura, matrices de decisión D1–D4 y criterios de aceptación | Revisión manual; dejó 2 preguntas abiertas ("User Review Required") que se resolvieron con investigación en la sesión siguiente |
| Claude Code | Análisis completo del repo + investigación senior de cada supuesto técnico de SPECS | Verificación contra fuentes primarias: catálogo Bitnami/Broadcom, Hooks API de Moodle 4.4+, `grade_calculator` vs `quiz_save_best_grade`, máquina de estados del attempt, subplugins `quiz_`, mapeo seed→moosh | ⚠️ **4 supuestos de SPECS estaban rotos o desactualizados** (imagen inexistente, hook deprecado, API legacy, detección de gracia incompleta). Ver "Lección 1". Corregidos en SPECS/IMPLEMENTATION_PLAN **antes** de generar código |
| Claude Code | `compose.yml` + `.env.example` | Generación del stack MariaDB + `erseco/alpine-moodle:v4.5.12` (tag verificado vía Docker Hub API; puertos/env vars/volúmenes tomados verbatim del compose upstream) | ⚠️ Válido en sintaxis (`docker compose config`) pero **3 hallazgos bloqueantes al ejecutarlo** (F2 sitename con espacios, F3 UTF-8, F4 healthcheck doble). Ver "Lección 2". Validado levantando el stack hasta `healthy` |
| Claude Code | Seeding completo: `seed.sh`, `seed-questions.xml` (6 tipos), `seed-course-setup.php`, `reset-attempts.sh` | Estructura idempotente (checks SQL antes de crear), banco Moodle XML, matriculaciones y preguntas vía API oficial | 3 corridas consecutivas sin duplicados ni errores; SQL directo confirmando settings (`timelimit=120, graceperiod=60, overduehandling=graceperiod`); login real de los 4 roles vía `authenticate_user_login()`; `reset-attempts.sh` ejecutado |
| Claude Code | Depuración en vivo de moosh contra Moodle 4.5 | Diagnóstico de cada crash (sintaxis con `--help` dentro del contenedor, inspección de salida cruda, SQL de verificación) | ⚠️ **moosh falló en 3 de sus comandos** (F5 course-enrol, F6 parent=0, F8 CLI sin sesión) + F7 path mangling de Git Bash. Ver "Lección 3". Cada fix re-validado con corrida completa del seed |
| Antigravity | Migración npm→pnpm + `package.json` | Localizar referencias (4 archivos), generar `package.json` con versiones investigadas (`@playwright/test ^1.61`, `typescript ^7.0.2`, `dotenv ^17.4.2`, `packageManager pnpm@10.12.4`) | Versiones verificadas con búsqueda web (jul 2026); `pnpm dlx` confirmado como equivalente correcto de `npx` |
| Claude Code | Documentación de hallazgos y este registro | Redacción de `docs/findings.md` (F1–F8 con causa, evidencia y resolución) y sincronización de SPECS/IMPLEMENTATION_PLAN/TASKS con la realidad | Revisión cruzada: cada hallazgo tiene su fix comentado en el código que lo sufrió |
| Claude Code | Base de validación automatizada: `scripts/verify-env.sh` (smoke del entorno) | Automatización de la verificación manual del hito: seed ×2 (idempotencia) + 13 asserts (SQL directo sobre `mdl_*` + `authenticate_user_login` de los 4 roles) | Corrida local completa: 13/13 ok, exit code correcto |
| Claude Code | Pipeline CI (`.github/workflows/e2e.yml`) + `dependabot.yml` | Jobs estático (shellcheck, `php -l`, `compose config`, gitleaks) → env-smoke (stack desde cero + verify-env) → e2e condicional con caché pnpm/Playwright precableada | ⚠️ **actionlint cazó un bug real en el primer output de la IA**: `hashFiles` no es válido en `if` de job. Ver "Lección 4". Cada gate del pipeline se ejecutó localmente vía Docker antes de commitear: shellcheck exit 0, `php -l` limpio, actionlint exit 0, gitleaks 0 fugas |

## Decisiones NO delegadas a la IA

- Arquitectura y capas (D1–D5): las matrices de trade-offs son criterio propio; la IA aportó los datos verificados de cada celda.
- Diseño de los criterios de aceptación (§2.3, §3.3 de SPECS): definen qué es "correcto" — no puede venir de la IA.
- Umbrales funcionales: >3 pérdidas de foco, 10% de penalización default, gracia de 60s (mínimo de `graceperiodmin`).
- Aprobación del enfoque frontend para la vista del profesor (Cambio 2): la IA presentó dos vías viables (inyección DOM con data-attribute vs. subplugin `quiz_`); el trade-off costo/beneficio (~3x boilerplate) lo decidí yo, y la alternativa quedó documentada para la defensa.
- Estrategia de regrade (Cambio 4): modificar `sumgrades` + propagar con `grade_calculator`, tras confirmar que `quiz_save_best_grade` es legacy.
- Qué es assert real vs. humo, y el veredicto final sobre cada línea que entra al repo.

## Validación del output de IA

- **Infraestructura:** se valida ejecutándola — stack levantado hasta `healthy`, no solo `docker compose config`.
- **Scripts:** corrida real con exit code + idempotencia probada (3 ejecuciones de `seed.sh`).
- **Datos sembrados:** SQL directo contra `mdl_quiz`, `mdl_question`, `mdl_question_categories` — no la UI solamente.
- **Credenciales:** `authenticate_user_login()` real para los 4 roles, no "la página de login carga".
- **Afirmaciones técnicas:** contra fuentes primarias (phpdoc/moodledev, Docker Hub API, compose upstream verbatim, `--help` de moosh en vivo), nunca contra la memoria del modelo.

## Lección documentada 1 (specs): los supuestos técnicos caducan — se verifican antes de generar código

`SPECS.md` v1 asumía `bitnami/moodle` (retirado del catálogo gratuito por Broadcom en 2025), el callback `before_footer` (deprecado desde Moodle 4.4 a favor de la Hooks API) y `quiz_save_best_grade` (legacy pre-4.2, reemplazado por `grade_calculator`). Ninguno era detectable leyendo la spec: eran correctos cuando se escribieron los docs de referencia con los que se entrenó el modelo. La conclusión operativa: **antes de generar código desde una spec, cada dependencia externa (imágenes, APIs, hooks) se verifica contra su fuente primaria actual** — el costo es una sesión de investigación; el costo de no hacerlo habría sido generar dos plugins sobre APIs deprecadas y descubrirlo en la corrida.

## Lección documentada 2 (infra): la configuración generada por IA se valida ejecutándola

El `compose.yml` generado pasaba `docker compose config` y "se leía" correcto, pero la primera ejecución real reveló tres bloqueantes en cascada: el sitename con espacios crasheaba el instalador de la imagen (F2), MariaDB 11.4 no crea bases UTF-8 por defecto y Moodle aborta con `!! unicode !!` (F3), y el healthcheck fallaba por partida doble — `localhost` resuelve a `::1` en Alpine con nginx solo-IPv4, y `/login/index.php` responde 303 hacia el `wwwroot` (F4). Cada fix quedó comentado en el propio `compose.yml` con su hallazgo. Conclusión operativa: **el YAML/config de IA se valida arrancando el sistema hasta su estado verde** (`healthy`), nunca con lectura ni validación sintáctica.

## Lección documentada 3 (ecosistema): las herramientas de terceros tampoco se confían — se prueban comando a comando

El plan delegaba el seeding a moosh "según su documentación". En vivo, 3 de sus comandos fallaron contra Moodle 4.5: `course-enrol` pierde `$CFG->dirroot` y aborta (F5), `questioncategory-create` inserta la categoría con `parent=0` y el banco de la UI no la muestra (F6), y `quiz_add_random_questions` exige una sesión con capability que el CLI no tiene (F8). Además Git Bash reescribía los paths `/tmp/...` hacia rutas Windows antes de llegar al contenedor (F7). La resolución fue un **híbrido**: moosh para lo que sí funciona (usuarios, curso, import de banco, quizzes) y un script PHP CLI contra las APIs oficiales de Moodle (`enrol_try_internal_enrol`, `question_get_top_category`, `set_user(get_admin())`) para lo que no — con la sintaxis de cada comando moosh confirmada con `--help` dentro del contenedor antes de usarla. Conclusión operativa: **la documentación de una herramienta describe su intención, no su comportamiento contra tu versión — cada comando se prueba en el entorno real antes de entrar al script.**

## Lección documentada 4 (CI): el pipeline que valida también se valida — con linters, no con lectura

El primer workflow de GitHub Actions generado por la IA usaba `hashFiles('e2e/**/*.ts')` en el `if` a nivel de job para auto-activar la suite cuando existiera — se leía idiomático y correcto, pero `hashFiles` no está disponible en ese contexto (solo a nivel de step): el job e2e jamás se habría activado, **silenciosamente**. Lo detectó `actionlint` corrido en local vía Docker antes del primer push; la corrección fue el patrón de outputs entre jobs (`steps.detect.outputs.has_e2e` → `needs.env-smoke.outputs.has_e2e`). El mismo dogfooding aplicó a todo lo demás antes de entrar al pipeline: shellcheck sobre los scripts propios, `php -l` sobre el CLI de Moodle, y gitleaks confirmando que los passwords de prueba de `.env.example` no disparan falsos positivos. Conclusión operativa: **la configuración de CI es código que solo "corre" en el servidor — un fallo de contexto como este no revienta, se apaga en silencio; se valida con su linter específico en local, nunca esperando a ver si el pipeline pasa.**

## Hallazgos (bonus del enunciado)

Detalle completo con evidencia en [`docs/findings.md`](./docs/findings.md):

| ID | Componente | Discrepancia |
|---|---|---|
| F1 | Docker / imagen | `bitnami/moodle` retirado del catálogo gratuito de Docker Hub (2025) |
| F2 | `erseco/alpine-moodle` | Espacios en `MOODLE_SITENAME` crashean el instalador |
| F3 | MariaDB 11.4 | Sin `--character-set-server=utf8mb4` la BD nueva no es UTF-8 |
| F4 | Healthcheck | `localhost` → `::1` en Alpine + `/login` responde 303 |
| F5 | moosh vs 4.5 | `course-enrol` pierde `$CFG->dirroot` |
| F6 | moosh | `questioncategory-create` inserta con `parent=0` (invisible en UI) |
| F7 | Windows/MSYS | Git Bash reescribe paths `/tmp/` al pasarlos a docker |
| F8 | Moodle CLI | `quiz_add_random_questions` exige sesión con capability `useall` |

## Pendientes de documentar

- [ ] Generación del plugin `local_focusguard` (cada archivo con su revisión)
- [ ] Generación del plugin `local_graceguard` (cada archivo con su revisión)
- [ ] Generación de `playwright.config.ts`, `global-setup.ts`, Page Objects y specs 01–10
- [ ] Workflow de CI (`.github/workflows/e2e.yml`)
- [ ] Comportamiento real de los campos del attempt durante la gracia (candidato #1 según SPECS)
- [ ] Firma real de `quiz_settings::get_grade_calculator()` en 4.5 vs. documentación

---

*Última actualización: 2026-07-11, post-baseline de validación automatizada (verify-env 13/13, CI estático + env-smoke + e2e condicional, dependabot). Este documento se actualiza en tiempo real durante el desarrollo.*
