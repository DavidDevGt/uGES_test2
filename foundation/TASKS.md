# Tareas: Desarrollo AI-first y QA Automatizado (Moodle)

## Entorno e Infraestructura
- `[x]` Crear `compose.yml` + `.env.example` con Moodle (`erseco/alpine-moodle` @ 4.5 LTS) y MariaDB
- `[x]` Crear `scripts/seed.sh` (moosh: categoría, curso, usuarios, banco desde `seed-questions.xml`, exámenes) — verificado idempotente (3 corridas)
- `[x]` Crear `scripts/seed-course-setup.php` (matriculaciones vía API + preguntas fijas + aleatoria al quiz)
- `[x]` Crear script de limpieza `scripts/reset-attempts.sh` (moosh `quiz-delete-attempts`) — probado

## Cambio 2: `local_focusguard`
- `[ ]` Estructura básica del plugin (`version.php`, `lang/en/...`)
- `[ ]` Definir esquema de DB (`install.xml` -> `local_focusguard_counts`)
- `[ ]` Crear Web Service (`services.php`, `externallib.php`)
- `[ ]` Crear módulo AMD JS para capturar `blur` y `visibilitychange`
- `[ ]` Hook en `lib.php` para inyectar JS en `mod/quiz/attempt.php`
- `[ ]` Hook en `lib.php` para inyectar badge de alerta en la vista de reportes

## Cambio 4: `local_graceguard`
- `[ ]` Estructura básica del plugin (`version.php`, `lang/en/...`)
- `[ ]` Definir esquema de DB (`install.xml` -> `local_graceguard_log`)
- `[ ]` Página de configuración de administrador (`settings.php`)
- `[ ]` Crear Event Observer para `\mod_quiz\event\attempt_submitted`
- `[ ]` Lógica de recálculo de calificación y log de auditoría
- `[ ]` Modificar vista de revisión para mostrar mensaje al estudiante

## Suite QA (Playwright)
- `[ ]` Inicializar package.json e instalar Playwright
- `[ ]` Crear `playwright.config.ts` y `global-setup.ts`
- `[ ]` Configurar fixtures y manejo de roles (`admin`, `teacher`, `student`)
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
