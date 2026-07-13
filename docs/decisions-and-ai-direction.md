# Decisiones y dirección de IA

> Entregable 5 del enunciado (1–2 páginas). Qué construí y por qué, cómo dirigí la IA, y qué
> encontré en el camino. Los registros completos son los anexos: `AI_USAGE.md` (dirección de
> IA, sesión por sesión) y `docs/findings.md` (los 23 hallazgos con causa y evidencia).

## Qué construí

Alcance según correo de GES: **automatización del QA del módulo de exámenes (12 flujos, completo)** + **Cambio 2** (señal de integridad por pérdida de foco) + **Cambio 4** (penalización por entrega en período de gracia). Cambios 1 y 3 excluidos por el equipo.

- **Entorno reproducible** (`compose.yml` + `seed.sh`): tres comandos, cero pasos manuales, con `verify-env.sh` (22 asserts) como fail-fast.
- **Dos plugins `local_`** que no tocan el core: `local_focusguard` (Hooks API + web service AJAX + módulo AMD) y `local_graceguard` (event observer + settings + regrade + mensaje al estudiante).
- **Suite E2E Playwright + TypeScript**: 36 tests, < 11 min, repetible, con evidencia (trace/video/HTML) y CI en GitHub Actions.

## Decisiones de ingeniería (mías, con su trade-off)

| Decisión | Alternativas evaluadas | Por qué |
|---|---|---|
| **Playwright + TS** para el QA | Behat (nativo Moodle), Cypress, Selenium | Contexts multi-rol nativos, traces/video/HTML sin plugins, sharding, y TS es el stack del equipo. Costo honesto: reconstruí lo que Behat da gratis (la espera `pending_js` fue F13). |
| **Plugins `local_`** para los cambios | Modificar `mod_quiz` (prohibido: core), tema custom (frágil) | Sobreviven upgrades, se instalan/desinstalan limpio, son la capa razonable que evalúa el enunciado. |
| **Imagen `erseco/alpine-moodle` 4.5 LTS** | Bitnami (el enunciado la sugiere), moodlehq | Bitnami fue retirada del catálogo gratuito de Docker Hub (2025); moodlehq no trae Moodle. erseco auto-instala y trae moosh. *Es una desviación de la instrucción literal — declarada aquí a propósito.* |
| **Detección de gracia por evento** `attempt_becameoverdue` | Delta temporal `timefinish − timestart` | El delta no distingue un envío en gracia inmediato de un envío normal procesado lento (F20). La máquina de estados es la fuente fiable. |
| **Matriz de aislamiento** (par quiz-usuario por spec + `teacher2`) | Un solo usuario compartido | `fullyParallel` con estado compartido produce colisiones y rompe "repetible" (criterio del enunciado). |

## Cómo dirigí la IA

**Herramientas:** Antigravity (planificación, docs) y Claude Code / Fable 5 (investigación verificada, generación, depuración en vivo). Método spec-driven: cada componente se generó desde su sección de `SPECS.md`, con una segunda capa de validación técnica sobre el output.

**Qué delegué:** boilerplate de plugins, Page Objects, conversión de criterios de aceptación a specs, investigación de APIs contra fuentes primarias.
**Qué decidí yo:** arquitectura y capas, criterios de aceptación, umbrales, qué es assert real vs. humo, y el veredicto sobre cada línea que entró al repo.

**Cómo validé** (nunca por lectura): el código se ejecuta. Los plugins se instalaron y se verificaron en BD; la suite se corrió contra la app real iterando cada fallo con su evidencia (aria snapshots, DOM vivo, SQL, traces); el entorno se levantó desde cero; la config de CI se validó con su linter (actionlint cazó un `hashFiles` inválido antes del primer push). Cuatro lecciones operativas quedaron documentadas en `AI_USAGE.md`: los supuestos de las specs caducan (se verifican antes de generar), la config se valida ejecutándola, las herramientas de terceros se prueban comando a comando, y el CI se valida con su linter.

## Qué encontré en el camino (el bonus)

**23 hallazgos documentados** en `findings.md`. Los que más valen para la defensa:

- **La suite encontró dos bugs reales de los cambios del mes**, no solo del entorno: **F19** — cada navegación entre páginas del intento contaba como pérdida de foco (falso positivo que arruinaba la señal de integridad); **F20/F23** — la detección de gracia y el regrade tienen comportamientos de Moodle no evidentes que definen el diseño correcto. Esto es la demostración empírica del "40h→2h sin perder confianza".
- **Discrepancias documentación vs. realidad de Moodle 4.5:** la pregunta aleatoria excluye las preguntas ya fijas del quiz (F14); `moosh course-enrol`/`quiz-delete-attempts` incompatibles con 4.5 (F5, F15); `core/togglesensitive` borra el password tecleado durante su init async (F13); el "Edit mode" del gradebook es una preferencia de servidor por-usuario que contamina contextos paralelos (F21).
- **Diagnóstico forense demostrado** (F13): del CI rojo → artefactos → body del POST en el trace → fuente del módulo en el contenedor → fix con espera estilo Behat.

## Estado de entrega

36/36 tests verdes, suite repetible (2 corridas consecutivas sin intervención), CI verde. Reproducible con `cp .env.example .env && docker compose up -d && ./scripts/seed.sh && pnpm test`.
