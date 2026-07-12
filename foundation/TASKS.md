# Tareas: Desarrollo AI-first y QA Automatizado (Moodle)

## Entorno e Infraestructura
- `[x]` Crear `compose.yml` + `.env.example` con Moodle (`erseco/alpine-moodle` @ 4.5 LTS) y MariaDB
- `[x]` Crear `scripts/seed.sh` (moosh: categoría, curso, usuarios, banco desde `seed-questions.xml`, exámenes) — verificado idempotente (3 corridas)
- `[x]` Crear `scripts/seed-course-setup.php` (matriculaciones vía API + preguntas fijas + aleatoria al quiz)
- `[x]` Crear script de limpieza `scripts/reset-attempts.sh` (moosh `quiz-delete-attempts`) — probado

## Cambio 2: `local_focusguard`
- `[x]` Estructura básica del plugin (`version.php`, `lang/en/...`)
- `[x]` Definir esquema de DB (`install.xml` -> `local_focusguard_counts`, campo `blurcount` — no `count`, palabra SQL)
- `[x]` Crear Web Service (`services.php` + `classes/external/report_blur.php`, patrón `core_external` 4.x)
- `[x]` Crear módulo AMD JS para capturar `blur` y `visibilitychange` (debounce 1s, fallo no bloquea)
- `[x]` Hooks API (`db/hooks.php` + `hook_callbacks`) para inyectar JS en la página del intento
- `[x]` Badge en la vista de reportes: data-attribute JSON + `report.js` + `styles.css` (alerta si >3)
- `[ ]` Verificación E2E funcional (spec 09)

## Cambio 4: `local_graceguard`
- `[x]` Estructura básica del plugin (`version.php`, `lang/en/...`)
- `[x]` Definir esquema de DB (`install.xml` -> `local_graceguard_log`, UNIQUE attemptid = idempotencia)
- `[x]` Página de configuración de administrador (`settings.php`: enabled + penaltypct, defaults verificados en BD)
- `[x]` Event Observer para `\mod_quiz\event\attempt_submitted` (internal=false, doble señal de detección)
- `[x]` Lógica de penalización + log de auditoría + regrade vía `grade_calculator` (fallback legacy documentado)
- `[x]` Mensaje al estudiante en la revisión vía Hooks API (`#local-graceguard-notice`)
- `[ ]` Verificación E2E funcional (spec 10, con timer real)

## Suite QA (Playwright)
- `[x]` Inicializar package.json e instalar Playwright (pnpm 11.9, @playwright/test 1.61.1, TS 7.0.2)
- `[x]` Crear `playwright.config.ts` (projects setup/core/timed) y `auth.setup.ts` (storageState por rol)
- `[x]` Configurar fixtures y manejo de roles (`roles.ts`, `testdata.ts`) — smoke 7/7 verde contra el stack vivo
- `[ ]` Implementar Page Objects (`pages/*.ts`)
- `[ ]` Escribir Specs funcionales (flujos 1 al 12)
- `[ ]` Escribir Specs para Cambio 2 y Cambio 4
- `[/]` Configurar CI (GitHub Actions) — pipeline activo: estático (shellcheck, php -l, compose config, gitleaks) + smoke del entorno (seed x2 + 13 asserts); el job e2e se auto-activa cuando exista la suite

## Validación automatizada (base de calidad)
- `[x]` `scripts/verify-env.sh` — smoke test del entorno: seed idempotente + 13 asserts SQL/login (local y CI)
- `[x]` `.github/workflows/e2e.yml` — estático → env-smoke → e2e condicional, con caché pnpm/Playwright preparada
- `[x]` `.github/dependabot.yml` — docker (majors/minors de Moodle excluidos por D5), actions, npm

## Entrega (logística — del correo y enunciado)
- `[ ]` Justificar en README la desviación de imagen Docker (enunciado dice "Bitnami o la oficial"; ver F1)
- `[ ]` `docs/decisions-and-ai-direction.md` CORTO (1–2 págs) — el entregable 5; AI_USAGE.md y findings.md son anexos
- `[ ]` En `docs/40h-to-2h.md` citar que los cambios 1 y 3 fueron excluidos por el equipo (correo 2026-07-10)
- `[ ]` Push a GitHub privado + dar acceso al equipo GES + correo de envío (antes del mar 14 mediodía)

## Documentación
- `[ ]` Redactar `docs/40h-to-2h.md`
- `[ ]` Redactar `docs/coverage-report.md`
- `[ ]` Documentar decisiones y dirección de IA
- `[ ]` Crear walkthrough.md final
