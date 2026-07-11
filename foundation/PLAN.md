# PLAN.md — Prueba Técnica 2: QA automatizado del módulo de exámenes de Moodle

> **Alcance:** automatización del QA del módulo de exámenes (alcance completo) y los cambios restantes indicados en el documento (Cambio 2 y Cambio 4).
> **Entrega:** martes 14 de julio. **Dedicación estimada del scope:** 14–18 h.
> **Regla de oro de la prueba:** todo el código se genera *dirigiendo IA* (obligatorio), con evidencia del proceso, y se defiende línea por línea en la sesión en vivo — donde llega un **quinto cambio** a implementar y cubrir en directo.

---

## 1. Principios de ejecución

1. **Spec primero, código después.** Cada componente (plugin, suite, seeding) se genera desde su sección de `SPECS.md`. Si la spec cambia, se edita la spec y se regenera — nunca al revés. Es literalmente su metodología; el repo debe demostrarla.
2. **El entorno es un entregable.** "Lo podemos levantar sin pelear con el setup" es criterio de evaluación explícito. Objetivo: `docker compose up -d && ./scripts/seed.sh && npm test` — tres comandos, cero pasos manuales.
3. **Diseñar para el quinto cambio.** La arquitectura de la suite (Page Objects + fixtures + helpers) debe hacer que cubrir un cambio nuevo cueste ~20 minutos en vivo. La sesión se gana en la arquitectura, no en la improvisación.
4. **Evidencia desde el minuto uno.** Carpeta `docs/ai-direction/` con las specs dadas a la IA, correcciones hechas, bugs detectados en el output. Ese material es el entregable 5 y el guion de la defensa.
5. **Asserts reales, cero humo.** Cada test verifica estado real (nota en gradebook, conteo en DB/UI, intento cerrado), nunca solo "la página cargó".

---

## 2. Cronograma (vie 10 → mar 14)

| Día | Bloque | Objetivo verificable |
|---|---|---|
| **Vie (noche, 2h)** | Entorno | Moodle corriendo en Docker (Bitnami), login por rol OK, primer borrador de `seed.sh` creando curso + 3 usuarios. **Riesgo #1 de la prueba (pelear con el entorno) muere hoy.** |
| **Sáb (5–6h)** | Cambios | AM: Cambio 4 (observer + settings + gradebook) funcionando con test manual. PM: Cambio 2 (JS + web service + vista profesor) funcionando. Commit por hito. |
| **Dom (6h)** | Suite core | Los 12 flujos del scope en Playwright: AM flujos 1–5 (profesor/banco), PM flujos 6–12 (estudiante/calificación/restricciones). Seeding integrado como global-setup. |
| **Lun (4–5h)** | Cierre técnico + docs | Cobertura de cambios 2 y 4 en la suite. CI (GitHub Actions) verde con reporte HTML + traces como artefactos. Redactar: cuenta 40h→2h, reporte de cobertura, doc de decisiones y dirección de IA. Grabar video de 5 min (opcional pero lo hago: es el bonus barato). |
| **Mar (AM, 2h)** | Corrida virgen + envío | Clonar el repo en un directorio limpio, seguir el README al pie de la letra, corrida completa desde cero. Ajustar README con lo que falló. **Enviar antes del mediodía** — mismo patrón que la prueba 1. |

**Regla de corte:** si el domingo a las 6pm faltan flujos, se priorizan los de mayor valor de negocio (6–9: rendir/timer/enviar/calificar) y los restantes se declaran en el reporte de cobertura con plan — el enunciado lo permite explícitamente si se justifica con criterio.

---

## 3. La cuenta 40h → 2h (defendible, no inventada)

**Desglose de las ~40 h manuales actuales** (estimación razonada del trabajo de 1 QA validando el módulo tras los cambios del mes):

| Actividad manual hoy | h/mes |
|---|---|
| Regresión de configuración de exámenes y banco de preguntas (flujos 1–5) | ~10 |
| Regresión del ciclo del estudiante: intentos, navegación, timer, envío (flujos 6–8) | ~12 |
| Calificación, recalificación, overrides y reportes (flujos 9–11) | ~8 |
| Restricciones de acceso y opciones de revisión (flujos 4, 12) | ~5 |
| Validación específica de los cambios nuevos del mes | ~5 |
| **Total** | **~40** |

**Después de la automatización:**

| Actividad humana restante | h/mes |
|---|---|
| Revisar el reporte de la corrida nocturna/por-PR (verde o triage de rojos) | ~0.5 |
| Validación exploratoria de lo NO automatizable declarado (UX visual de la penalización, criterio pedagógico del feedback, emails reales) | ~1.0 |
| Mantenimiento de la suite ante cambios del mes (actualizar fixtures/POs) | ~0.5 |
| **Total** | **~2.0** |

**Demostración con los cambios de este mes:** Cambio 2 → la suite verifica automáticamente conteo, persistencia y marcado visual >3 (lo que a mano serían ~2h de matrices de casos); el humano solo mira 5 min el reporte. Cambio 4 → la suite verifica penalización aplicada, nota en gradebook y mensaje al estudiante con timer real expirando (a mano: ~3h por lo tedioso de esperar timers); el humano valida 10 min que el wording del mensaje sea claro. **Qué corrió solo vs. qué validó el humano queda tabulado por cambio en el reporte.**

**Por qué se sostiene los meses siguientes:** la suite corre en CI en cada PR (nadie tiene que acordarse de ejecutarla); los Page Objects aíslan los cambios de UI en un solo lugar; el seeding programático elimina la fragilidad de datos; y agregar cobertura de un cambio nuevo = 1 page object (si hay pantalla nueva) + 1 spec — el costo marginal que voy a demostrar en vivo con el quinto cambio.

---

## 4. Entregables (mapeo exacto contra el enunciado)

| # | Entregable pedido | Dónde vive |
|---|---|---|
| 1 | Repo con solución completa | GitHub privado con acceso para GES: plugins + suite + scripts + docs |
| 2 | Solución corriendo + evidencia | `README.md` (3 comandos) + reporte HTML de Playwright + traces/videos de una corrida real como artefacto de CI y en `docs/evidence/` |
| 3 | Cuenta 40h→2h | `docs/40h-to-2h.md` (tabla de §3, demostrada con los cambios 2 y 4) |
| 4 | Reporte de cobertura vs scope | `docs/coverage-report.md`: matriz flujo→spec→asserts clave, con exclusiones justificadas y su plan manual |
| 5 | Doc de decisiones y dirección de IA (1–2 págs) | `docs/decisions-and-ai-direction.md`: qué construí y por qué, cómo dirigí la IA (herramienta, delegado vs. decidido, cómo validé), y **hallazgos** (bugs/discrepancias de Moodle — el bonus) |
| 6 | Video 5 min (opcional) | Lo entrego: pantalla de la suite absorbiendo el Cambio 4 — demuestra el punto central de "se sostiene ante cambios" |

---

## 5. Preparación de la sesión en vivo (quinto cambio)

- **Predicciones de qué puede ser** (extiende algo ya construido): umbral configurable de pérdidas de foco / notificar al profesor cuando un intento supere el umbral / penalización escalonada por tiempo excedido / exportar señales de integridad a un reporte. Todas caen en: *settings nuevo + lógica en observer o JS + columna en vista + spec nuevo*. Mi arquitectura ya tiene ese camino pavimentado.
- **Ensayo previo:** implementar en casa un "sexto cambio" inventado (p. ej. umbral configurable del marcado visual del Cambio 2) cronometrado, dirigiendo la IA igual que en la sesión. Si en casa toma 25 min, en vivo con nervios toma 40 — cabe en la sesión.
- **Setup del día:** entorno ya levantado antes de la llamada, suite recién corrida en verde, Claude Code abierto en el repo, y el doc de dirección de IA a mano como guion.
- Ante cualquier pregunta de "¿por qué X?": la respuesta empieza por el trade-off evaluado, no por la preferencia. Las matrices de decisión de `SPECS.md` son el arsenal.

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| Entorno Docker consume el fin de semana | Imagen `erseco/alpine-moodle` pineada a Moodle 4.5 LTS (auto-instala por env vars, moosh embebido); fallback: `bitnamilegacy/moodle` pineada (congelada). *Verificado 2026: `bitnami/moodle` fue retirado del catálogo gratuito de Docker Hub; `moodlehq/moodle-php-apache` no incluye Moodle* |
| Timers reales hacen tests lentos/flaky | Exámenes de prueba con límite de 1–2 min creados por seeding; `test.slow()` solo donde el timer es el sujeto del test; el resto de flujos no espera timers |
| Flakiness en UI de Moodle (modals, ajax) | Web-first assertions de Playwright, sin sleeps fijos; retry=1 en CI con trace-on-retry para diagnosticar |
| Selectores frágiles de Moodle | Page Objects con selectores por rol/label (accesibilidad) antes que clases CSS generadas |
| El quinto cambio toca algo imprevisto | La arquitectura por capas (seed/PO/spec) hace que "imprevisto" = un archivo nuevo, no una reescritura |
| Quedarse sin tiempo el domingo | Regla de corte de §2 + priorización por valor de negocio, con exclusiones justificadas (permitido por el enunciado) |