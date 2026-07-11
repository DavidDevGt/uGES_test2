# Tareas: Desarrollo AI-first y QA Automatizado (Moodle)

## Entorno e Infraestructura
- `[x]` Crear `compose.yml` + `.env.example` con Moodle (`erseco/alpine-moodle` @ 4.5 LTS) y MariaDB
- `[ ]` Crear `scripts/seed.sh` (moosh: categoría, curso, usuarios, banco desde `seed-questions.xml`, exámenes)
- `[ ]` Crear `scripts/seed-quiz-questions.php` (asignar preguntas fijas + aleatoria al quiz)
- `[ ]` Crear script de limpieza `scripts/reset-attempts.sh` (moosh `quiz-delete-attempts`)

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
- `[ ]` Configurar CI (GitHub Actions)

## Documentación
- `[ ]` Redactar `docs/40h-to-2h.md`
- `[ ]` Redactar `docs/coverage-report.md`
- `[ ]` Documentar decisiones y dirección de IA
- `[ ]` Crear walkthrough.md final
