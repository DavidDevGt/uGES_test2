# Auditoría de estrategia de QA Automatizado — benchmark contra Moodle HQ

> Fecha: 2026-07-12 · Auditor: Staff QA Automation (IA dirigida) · Estado del repo al auditar:
> entorno reproducible verde (verify-env 17/17), plugins instalados, harness Playwright (smoke 8/8),
> 7 Page Objects, CI en 2 workflows. **Cobertura funcional: 3/14 flujos (~21% smoke-level, 0% specs de negocio).**

---

## 1. Cómo testea Moodle HQ (investigación verificada)

Fuentes primarias: [moodledev.io/testing](https://moodledev.io/general/development/process/testing) ·
[Behat](https://moodledev.io/general/development/tools/behat) ·
[QA cycle](https://moodledev.io/general/development/process/testing/qa) ·
[moodle-plugin-ci](https://moodlehq.github.io/moodle-plugin-ci/) ·
[moodle-ci-runner](https://github.com/moodlehq/moodle-ci-runner)

| Práctica de Moodle HQ | Detalle |
|---|---|
| **PHPUnit obligatorio** | Todo parche nuevo debe cubrirse con unit tests y/o Behat. Sin tests, no se integra. |
| **Behat como acceptance** | Framework BDD propio sobre Mink/Selenium; corre **Firefox y Chrome varias veces al día** contra el repo de integración. `@javascript` se usa con tacañería (los tests JS son mucho más lentos). |
| **Espera de estabilidad** | Behat espera `M.util.pending_js` antes de cada step — la señal oficial de "Moodle terminó su JS". |
| **Paralelización** | Corridas paralelas = N instalaciones completas de Moodle con features repartidas (`--parallel`), con re-runs automáticos de fallos. |
| **CI de plugins (estándar comunidad)** | `moodle-plugin-ci`: phplint, phpcs (moodle-cs), phpdoc, validate, savepoints, mustache, grunt, **phpunit, behat** — la vara con la que la comunidad mide un plugin serio. |
| **QA manual estructurado** | Miércoles de testing manual semanal en HQ + ciclo QA comunitario de 4–6 semanas por release mayor (los tests MDLQA). Lo no-automatizable se gestiona, no se ignora. |
| **Datos de prueba** | Generators de Behat/PHPUnit crean datos por API, nunca por UI. |

**Lectura clave:** el modelo de Moodle es *pirámide*: unit (PHPUnit) → acceptance (Behat) → QA manual declarado. Y su lección más cara — la estabilidad JS — la aprendimos independientemente con F13 (`pending_js`), convergiendo con su solución oficial.

---

## 2. Benchmark: nuestro proyecto vs. la vara de la industria

| Dimensión | Moodle HQ / industria | Nosotros | Veredicto |
|---|---|---|---|
| Entorno reproducible | moodle-ci-runner + docker | compose + erseco pineada, 3 comandos, healthchecks | ✅ **A la par o mejor** (para este alcance) |
| Datos de prueba | Generators por API | moosh + PHP CLI idempotente, verificado 17/17 | ✅ Filosofía equivalente |
| Anti-flaky | pending_js, sin sleeps | pending_js (F13), storageState, editor textarea, web-first asserts | ✅ Convergimos con su práctica |
| Unit tests de plugins | **Obligatorios** | **Cero** | 🔴 Gap estructural #1 |
| Acceptance / E2E | Behat, FF+Chrome | Playwright, solo Chromium; 3 tests smoke | 🟠 Framework justificado (D1); **cobertura es el gap** |
| Análisis estático PHP | phpcs/moodle-cs, phpdoc, savepoints | `php -l` únicamente | 🟠 Bajo la vara comunitaria |
| CI | Multi-browser, paralelo, diario | 2 workflows, staged, caché, evidencia | ✅ Base sólida, sin sharding aún |
| Seguridad/deps | (no estándar en plugin-ci) | gitleaks + dependabot | ✅ **Por encima** del baseline Moodle |
| A11y / Visual / Perf | QA manual + herramientas ad-hoc | Nada | 🟠 Declarar como exclusión con plan |
| Exclusiones gestionadas | MDLQA manual cycle | coverage-report.md planificado | ✅ Alineado (pendiente de materializar) |

**Sobre Playwright vs. Behat (cuestionando nuestra D1):** Behat es el estándar del ecosistema y nos habría dado gratis lo que reconstruimos a mano (pending_js, generators, steps). El costo real de D1 quedó demostrado con F13. **El veredicto sigue siendo que D1 es correcta para este contexto** — el consumidor de la suite es el equipo GES (stack TS valorado en la JD), Playwright da traces/videos/HTML report nativos que Behat no, y el sharding es más barato — pero la defensa debe presentar este trade-off con el costo pagado, no como victoria gratuita.

---

## 3. Hallazgos críticos

### C1 — Cobertura funcional: 0 de 12 flujos de negocio automatizados 🔴
Lo único verde es infraestructura. Los specs 01–10 son EL entregable; todo lo demás es andamiaje. *(Es el plan del domingo — el hallazgo es que nada debe desplazarlo.)*

### C2 — Colisión de datos entre specs paralelos (punto ciego real) 🔴
`fullyParallel: true` + un solo `student1` compartido = dos specs que intenten `quiz-general` a la vez chocarán ("attempt already in progress" / intentos consumidos). Además `quiz-timed` tiene `attempts=2`: dos corridas de la suite sin reset agotan los intentos — **rompe el criterio "repetible" del enunciado**.
**Fix:** matriz spec→usuario (student1 = flujos de intento core; student2 = timed; sembrar student3 si un tercer spec necesita intentos) + `reset-attempts` cableado en `beforeAll` de los specs que consumen intentos (vía `execSync('bash scripts/reset-attempts.sh')` — corre donde corre Playwright, que siempre tiene docker).

### C3 — Cero PHPUnit para la lógica de los plugins 🔴 (la vara HQ)
La matriz de borde del observer (¿gracia exacta en el límite? ¿penalty 0? ¿100? ¿doble evento? ¿sumgrades null?) y la seguridad del WS (intento ajeno, estado incorrecto) se prueban hoy SOLO vía E2E — carísimo por caso. 6–8 unit tests dentro del contenedor (`vendor/bin/phpunit` de Moodle inicializado) cubren la matriz en segundos. Moodle HQ no integraría estos plugins sin ellos.

### C4 — Análisis estático PHP bajo la vara comunitaria 🟠
`php -l` detecta sintaxis; `moodle-plugin-ci codechecker` (moodle-cs) detecta violaciones del estándar Moodle, phpdoc faltante, savepoints. Un job opcional de plugin-ci sube el listón con ~30 líneas de workflow.

### C5 — El presupuesto de tiempo de los specs timed es frágil 🟠
El flujo de gracia real = esperar 2 min de timer + enviar dentro de 1 min de gracia (el **mínimo** de `graceperiodmin`). En un runner cargado, la ventana de envío es justa. **Mitigación preventiva:** subir gracia a 120 s en el seed (sigue siendo "corto"), y `timed` ya está serializado con timeout propio.

### C6 — verify-env.sh no corre en el workflow E2E 🟡
`e2e.yml` hace seed y corre la suite, pero no ejecuta los 17 asserts (fail-fast de 30 s que distingue "entorno roto" de "test roto"). Una línea.

---

## 4. Riesgos actuales

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Deadline martes vs. 10 specs pendientes | Media | Alto | Regla de corte de PLAN §2 + exclusiones justificadas (permitidas) |
| Flakiness de specs con timer real | Media | Medio | C5: gracia 120s + proyecto serial + retry CI con trace |
| Colisión de datos en paralelo (C2) | **Alta** al escribir specs | Alto | Matriz spec→usuario + reset en beforeAll ANTES de escribir los specs |
| Regresión de plugins sin unit tests | Media | Medio | C3: suite PHPUnit mínima |
| Bus factor (1 persona) | — | Medio | Ya mitigado: findings.md + AI_USAGE + specs como documentación viva |

---

## 5. Priorización

### Alta (antes de la entrega — horas)
1. **A1 · Specs 01–10** — el entregable. Orden por valor: 04 (intento+calificación) → 09/10 (cambios) → 05 (timer) → 01/02 → resto.
2. **A2 · Aislamiento de datos** (C2): matriz spec→usuario documentada en `testdata.ts` + `reset-attempts` en `beforeAll` de specs con intentos. *Hacerlo AHORA, antes de los specs — retrofitearlo cuesta el triple.*
3. **A3 · PHPUnit mínimo de plugins** (C3): init phpunit en el contenedor + tests del observer (matriz de gracia/penalización/idempotencia) y del WS (ownership/estado). Step opcional en CI.
4. **A4 · verify-env.sh en e2e.yml** (C6) + gracia 120 s en seed (C5).

### Media (post-entrega inmediato — días)
5. **M1 · moodle-plugin-ci** (codechecker+phpdoc) como job de CI para `plugins/`.
6. **M2 · A11y smoke con @axe-core/playwright** en 3 páginas (login, vista quiz, intento) — en educación la accesibilidad es requisito legal en muchos mercados; 1 spec, valor desproporcionado.
7. **M3 · Sharding** (`--shard` + blob reports merge) cuando la suite supere ~10 min.
8. **M4 · Publicar HTML report** en GitHub Pages + summary en PRs.

### Baja (madurez open-source — semanas)
9. **B1 · Visual regression dirigida**: 1 `toHaveScreenshot` del badge del Cambio 2 (tema default; otros temas = revisión manual trimestral ya declarada en SPECS).
10. **B2 · Firefox** como proyecto nightly (`workflow_dispatch` + cron), no por push.
11. **B3 · Performance**: k6 smoke (login + attempt) con presupuestos p95 — solo si el proyecto vive más allá de la prueba.
12. **B4 · Seguridad dinámica**: ZAP baseline contra el stack local.

---

## 6. Roadmap

```
Fase 0 — HOY (dom):        A2 (aislamiento) → A4 (quick wins) → A1 (specs, con regla de corte) → A3 (phpunit si el domingo lo permite; si no, lunes AM)
Fase 1 — Entrega (lun/mar): coverage-report.md declara: single-browser, a11y/visual/perf como exclusiones CON este plan como evidencia de criterio
Fase 2 — Mes 1:            M1–M4 (plugin-ci, axe, sharding, pages)
Fase 3 — Trimestre:        B1–B4 + evaluar interop Behat (el contenedor ya trae todo para inicializarlo)
```

**Criterio de éxito de la Fase 0:** suite corriendo 2 veces seguidas en CI, verde ambas, sin intervención — eso ES el enunciado ("corre sola, repetible, con evidencia").

---

## 7. Qué está por encima de la vara (para no perderlo)

- Cultura de evidencia: 13 hallazgos con causa raíz y fix — más de lo que muchos plugins publicados documentan.
- Diagnóstico forense demostrado (F13: artefactos → trace → POST body → fuente del módulo).
- gitleaks + dependabot: por encima del baseline de moodle-plugin-ci.
- El seed híbrido moosh+API con verificación 17/17 es más robusto que el promedio de la comunidad (que suele clickear el setup o restaurar backups opacos).
