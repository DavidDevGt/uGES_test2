# De ~40 horas a ~2 horas de validación manual mensual

> Entregable 3 del enunciado. Por qué esta solución deja la validación humana mensual del
> módulo de exámenes en ~2 horas, demostrado con los cambios de este mes. La cuenta es una
> estimación razonada, no un número inventado: cada línea se puede defender.

## 1. Las ~40 horas manuales de hoy

Estimación del trabajo de un QA validando el módulo de exámenes cada mes, tras los cambios que entran:

| Actividad manual | h/mes | Por qué cuesta eso |
|---|---|---|
| Regresión de configuración de exámenes y banco de preguntas (flujos 1–5) | ~10 | 6 tipos de pregunta × opciones de revisión × métodos de calificación = matriz amplia de clics |
| Ciclo del estudiante: intentos, navegación, timer, envío (flujos 6–8) | ~12 | Esperar timers reales es tedioso; cada tipo de pregunta se responde a mano |
| Calificación, recalificación, overrides y reportes (flujos 9–11) | ~8 | Verificar notas exactas en revisión Y en gradebook, por rol |
| Restricciones de acceso y opciones de revisión (flujos 4, 12) | ~5 | Contraseñas, ventanas de fecha, qué ve el estudiante y cuándo |
| Validación específica de los cambios nuevos del mes | ~5 | Casos de borde de cada cambio, a mano |
| **Total** | **~40** | |

## 2. Las ~2 horas que quedan tras la automatización

| Actividad humana restante | h/mes |
|---|---|
| Revisar el reporte de la corrida por-PR / nocturna (verde, o triage de rojos con trace) | ~0.5 |
| Validación exploratoria de lo declarado NO automatizable (UX visual del badge en otros temas, wording del mensaje de penalización, emails reales) | ~1.0 |
| Mantenimiento de la suite ante cambios del mes (actualizar fixtures/Page Objects) | ~0.5 |
| **Total** | **~2.0** |

## 3. Demostración con los cambios de ESTE mes

> Nota de alcance: el correo de GES (2026-07-10) excluyó los Cambios 1 y 3 de esta entrega. La
> demostración usa los dos cambios efectivamente construidos, que es donde la cuenta se prueba.

### Cambio 2 — señal de integridad por pérdida de foco

| | A mano | Automatizado |
|---|---|---|
| Qué hay que validar | Conteo correcto, persistencia tras recarga, marca visual al superar 3, que NO afecte la nota, y que un estudiante no reporte sobre intento ajeno | Los mismos 6 criterios, en `09-change2-focusguard` |
| Costo | ~2 h de armar matrices de casos y repetir gestos de foco | El humano mira el reporte ~5 min |
| Qué corrió solo | Los 6 criterios de §2.3, incluyendo el rechazo del web service a intentos ajenos | |
| Qué validó el humano | Que el badge se vea bien visualmente (5 min) | |

**Y encima:** la suite encontró un bug real del cambio (F19 — cada navegación contaba como pérdida de foco) que a mano probablemente se habría escapado o tardado horas en cuantificar.

### Cambio 4 — penalización por entrega en período de gracia

| | A mano | Automatizado |
|---|---|---|
| Qué hay que validar | Penalización aplicada, nota en gradebook, mensaje al estudiante, cambio de %, no duplicación en regrade, plugin desactivado | Los 6 criterios de §3.3, en `10-change4-graceguard`, **con timer real de 2 min expirando** |
| Costo | ~3 h por lo tedioso de esperar timers y verificar cada capa | El humano valida ~10 min que el wording sea claro |
| Qué corrió solo | Los 6 criterios, con la nota exacta verificada en revisión Y gradebook por capa | |
| Qué validó el humano | Claridad del mensaje "nota → penalización → nota final" (10 min) | |

**Y encima:** la suite reveló dos comportamientos reales de Moodle (F20 — la detección fiable de gracia es por evento, no por tiempo; F23 — el regrade nativo borra la penalización) que definen exactamente dónde el humano debe poner atención.

## 4. Por qué se sostiene los meses siguientes

- **Corre en CI en cada PR** — nadie tiene que acordarse de ejecutarla.
- **Los Page Objects aíslan la UI de Moodle** en un solo lugar: un cambio de tema o de versión se arregla una vez, no en 30 tests (los 23 hallazgos de `findings.md` ya están encapsulados ahí).
- **El seeding programático** (`seed.sh` idempotente + `verify-env.sh` con 22 asserts) elimina la fragilidad de datos.
- **Costo marginal de un cambio nuevo** = 1 Page Object (si hay pantalla nueva) + 1 spec. Es el camino que se demostrará en vivo con el quinto cambio.
- **Repetibilidad probada**: la suite corre dos veces seguidas sin intervención y queda verde — no "pasa una vez".
