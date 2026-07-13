# Walkthrough de la solución

> Recorrido guiado de la entrega: qué se levanta, cómo se prueba, y dónde vive cada pieza.
> Pensado para un evaluador que clona el repo por primera vez y quiere entender el todo en
> 10 minutos antes de leer el detalle.

## 1. La solución en una frase

Un entorno Moodle reproducible en Docker, dos plugins `local_` que implementan los cambios
del mes sin tocar el core, y una suite Playwright que valida los 12 flujos del módulo de
exámenes + ambos cambios de punta a punta — todo dirigido con IA y documentado línea por línea.

## 2. Levantarlo (3 comandos, cero pasos manuales)

```bash
cp .env.example .env
docker compose up -d          # MariaDB + Moodle 4.5.12 (auto-instala en el 1er arranque)
./scripts/seed.sh             # curso, usuarios, banco (6 tipos), 3 quizzes, instala plugins
```

Verificación rápida sin navegador (fail-fast, ~90 s):

```bash
./scripts/verify-env.sh       # 22 asserts: datos sembrados, plugins en BD, logins reales
```

Correr la suite:

```bash
pnpm install && pnpm test     # 36 tests, < 11 min, con reporte HTML + traces
pnpm test:report              # abre el reporte de la última corrida
```

## 3. Recorrido por capas

### Entorno (`compose.yml`, `scripts/`)
- **`compose.yml`** — MariaDB + `erseco/alpine-moodle:v4.5.12`. Los plugins se montan como
  bind mounts en `local/`. (Por qué esta imagen y no Bitnami: ver §5.)
- **`seed.sh`** — idempotente: crea categoría, curso `QA-EXAMS-101`, usuarios por rol,
  banco de 6 tipos (+ pool de reserva para la pregunta aleatoria), 3 quizzes
  (`quiz-general`, `quiz-timed`, `quiz-autosubmit`), sincroniza los builds AMD e instala
  los plugins. Lo que `moosh` no cubre lo hace `seed-course-setup.php` vía API oficial.
- **`reset-attempts.sh`** — limpia intentos por `(quiz, usuario)` entre corridas, para que
  los specs paralelos no se pisen.

### Cambios del mes (`plugins/`)
- **`local_focusguard`** (Cambio 2) — Hooks API (`before_footer_html_generation`) inyecta un
  módulo AMD que cuenta pérdidas de foco (blur/visibilitychange, debounce 1 s) y las reporta
  por un web service AJAX con validación de propiedad del intento. La vista del profesor
  recibe los conteos embebidos como JSON y los pinta como badge (rojo si > 3).
- **`local_graceguard`** (Cambio 4) — event observer sobre `attempt_submitted`: detecta el
  envío en gracia (por el evento `attempt_becameoverdue`), aplica la penalización configurable
  en una transacción, registra un log auditable y propaga la nota al gradebook. Un segundo
  hook muestra el desglose "nota → penalización → nota final" al estudiante en la revisión.

### Suite E2E (`e2e/`)
- **`playwright.config.ts`** — 3 proyectos: `setup` (auth por rol → `storageState`),
  `core` (paralelo), `timed` (serial, para los timers reales).
- **`pages/`** — Page Objects que encapsulan cada pantalla de Moodle; todo el conocimiento
  de selectores de Boost 4.5 vive aquí (un cambio de UI se arregla en un solo lugar).
- **`fixtures/`** — roles, datos sembrados y la matriz de aislamiento `(quiz, usuario)`.
- **`specs/`** — un archivo por grupo de flujos (ver mapa en §4).

## 4. Mapa flujo → spec

| Spec | Cubre |
|---|---|
| `01-quiz-configuration` | Flujos 1 (config) y 4 (opciones de revisión) |
| `02-question-bank` | Flujos 2 (6 tipos) y 3 (banco + aleatoria) |
| `03-teacher-preview` | Flujo 5 (preview del profesor) |
| `04-student-attempt` | Flujos 6, 8, 9 (rendir, enviar, calificación automática exacta) |
| `05-timer-autosubmit` | Flujo 7 (timer real + auto-envío) |
| `06-manual-grading-regrade` | Flujo 10 (calificar ensayo, recalificar) |
| `07-overrides-reports` | Flujo 11 (overrides + reportes) |
| `08-access-restrictions` | Flujo 12 (contraseña, ventana de fechas) |
| `09-change2-focusguard` | Cambio 2 (6 criterios de §2.3) |
| `10-change4-graceguard` | Cambio 4 (6 criterios de §3.3, timer real) |

Detalle con el assert clave de cada uno en [`coverage-report.md`](coverage-report.md).

## 5. Las tres decisiones que un evaluador preguntará primero

1. **¿Por qué Playwright y no Behat?** — Behat es el estándar de Moodle y habría dado gratis
   la espera `pending_js`; se eligió Playwright por los contexts multi-rol nativos, la
   evidencia (trace/video/HTML) sin plugins, el sharding, y porque TS es el stack del equipo.
   El costo de la decisión se pagó y quedó documentado (F13).
2. **¿Por qué `erseco/alpine-moodle` y no Bitnami?** — El enunciado sugiere "Bitnami o la
   oficial". Bitnami fue **retirada del catálogo gratuito de Docker Hub en 2025** y la "oficial"
   `moodlehq/moodle-php-apache` no contiene Moodle. `erseco` auto-instala por variables de
   entorno y trae `moosh`. Es una desviación deliberada y declarada (hallazgo F1).
3. **¿Por qué plugins `local_` y no otra capa?** — Sobreviven upgrades, se instalan/desinstalan
   limpio y no tocan el core (prohibido). Es la "capa razonable" que el enunciado evalúa.

## 6. El argumento central: la suite encontró bugs reales de los cambios

No solo verifica que los cambios funcionan — los **puso a prueba de verdad** y encontró
comportamiento que a mano se habría escapado:
- **F19** — cada navegación entre páginas contaba como pérdida de foco (falso positivo que
  arruinaba la señal de integridad del Cambio 2). Corregido.
- **F20 / F23** — la detección de gracia fiable es por evento, no por delta temporal; y el
  regrade nativo borra la penalización. Definen dónde el humano debe mirar.

Esto es la demostración empírica del "40h → 2h sin perder confianza" ([`40h-to-2h.md`](40h-to-2h.md)).

## 7. Índice de entregables

| # | Entregable | Dónde |
|---|---|---|
| 1 | Repo con la solución completa | Este repositorio (plugins + suite + scripts + docs) |
| 2 | Solución corriendo + evidencia | `README.md` (3 comandos) + reporte HTML de Playwright + CI |
| 3 | Cuenta 40h → 2h | [`docs/40h-to-2h.md`](40h-to-2h.md) |
| 4 | Reporte de cobertura | [`docs/coverage-report.md`](coverage-report.md) |
| 5 | Decisiones y dirección de IA | [`docs/decisions-and-ai-direction.md`](decisions-and-ai-direction.md) (corto) + [`AI_USAGE.md`](../AI_USAGE.md) y [`docs/findings.md`](findings.md) (anexos) |
| — | Hallazgos (bonus) | [`docs/findings.md`](findings.md) — 23 discrepancias documentación vs. realidad |
