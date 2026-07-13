# Reporte de cobertura — QA automatizado del módulo de exámenes

> Entregable 4 del enunciado. Mapea cada flujo del scope a la parte de la suite que lo
> cubre, con el assert clave (comportamiento real, no humo), y declara lo excluido con su
> plan manual. **Estado: 36/36 tests verdes, suite completa < 11 min, repetible (2 corridas
> consecutivas sin intervención).**

## 0. Composición de la suite

| Proyecto Playwright | Tests | Rol |
|---|---|---|
| `setup` | 6 | Autenticación por rol → `storageState` (admin, teacher, teacher2, student1-3) |
| `core` (paralelo) | ~28 | Flujos funcionales y Cambio 2 |
| `timed` (serial) | 7 | Flujos con timer real (flujo 7 y Cambio 4) |
| **Total** | **36** | |

Alcance según correo de GES (2026-07-10): **Cambios 1 y 3 excluidos de la entrega**; se implementan y cubren únicamente **Cambio 2** (`local_focusguard`) y **Cambio 4** (`local_graceguard`).

## 1. Cobertura del scope (12 flujos + 2 cambios)

| # | Flujo del scope | Spec | Assert clave (comportamiento real verificado) |
|---|---|---|---|
| 1 | Crear/configurar examen (timing, intentos, método) | `01-quiz-configuration` | El quiz creado **persiste** timing, intentos y método al **reabrir** settings (assert contra el form recargado, no contra el submit) |
| 2 | Banco: 6 tipos de pregunta | `02-question-bank` | Se crea por UI una pregunta de cada tipo (MC, V/F, corta, numérica, emparejamiento, ensayo) y cada una aparece listada |
| 3 | Agregar del banco + aleatorias | `02-question-bank` | El examen recibe una pregunta del banco y una aleatoria; ambas aparecen como slots |
| 4 | Opciones de revisión | `01-quiz-configuration` | Con "respuesta correcta" oculta hasta el cierre, el estudiante **NO** la ve tras enviar; tras cerrar el quiz, **SÍ** |
| 5 | Vista previa del profesor | `03-teacher-preview` | El profesor completa una preview y ve el resultado **sin** generar un intento de estudiante (0 filas suyas en el reporte) |
| 6 | Iniciar/responder/navegar/marcar | `04-student-attempt` | La navegación conserva respuestas; la marca "para revisar" aparece en el panel de navegación |
| 7 | Límite de tiempo y auto-envío | `05-timer-autosubmit` | Con timer expirado, el intento queda `Finished` **sin acción del estudiante** y la nota existe (1.00/2.00) |
| 8 | Enviar el intento | `04-student-attempt` | Confirmación de envío → estado "Finished" con timestamp "Completed" |
| 9 | Calificación automática + resultado | `04-student-attempt` | Respuestas conocidas (4 correctas, 1 incorrecta, 2 sin responder) → **nota exacta 4.00/7.00** en revisión **Y** en el gradebook |
| 10 | Calificar ensayo / recalificar | `06-manual-grading-regrade` | El profesor asigna 0.75 al ensayo → nota total del intento pasa a 1.75/7.00; el regrade no la corrompe |
| 11 | Overrides y reportes | `07-overrides-reports` | Override de nota visible en el gradebook y reversible; el reporte lista los intentos con su estado |
| 12 | Restricciones de acceso | `08-access-restrictions` | Sin contraseña (o incorrecta) no se inicia; con contraseña sí; fuera de la ventana de fechas el intento no está disponible |
| C2 | Señal de integridad por pérdida de foco | `09-change2-focusguard` | **Los 6 criterios de §2.3** (ver §2) |
| C4 | Penalización por entrega en gracia | `10-change4-graceguard` | **Los 6 criterios de §3.3** (ver §3) |

**Resultado: 12/12 flujos + 2/2 cambios cubiertos con asserts de estado real.**

## 2. Cambio 2 — criterios de aceptación (§2.3)

| Criterio | Verificado |
|---|---|
| 2 pérdidas de foco → conteo 2 sin marca | ✅ |
| 4 pérdidas → conteo 4 con marca visual (umbral > 3) | ✅ |
| El conteo persiste tras recargar la página del intento | ✅ |
| Intento sin pérdidas → muestra 0, sin marca | ✅ |
| La nota es idéntica con y sin pérdidas de foco | ✅ |
| Un estudiante no puede reportar blur sobre un intento ajeno (WS rechaza) | ✅ |

*Bug real encontrado y corregido por esta cobertura (F19): la navegación entre páginas del intento contaba como pérdida de foco (falso positivo por cada "Next page").*

## 3. Cambio 4 — criterios de aceptación (§3.3)

| Criterio | Verificado |
|---|---|
| Intento en tiempo normal → sin penalización, sin mensaje | ✅ |
| Intento enviado en gracia → nota reducida el % configurado, visible con el desglose | ✅ |
| El gradebook refleja la nota penalizada | ✅ |
| Cambiar el % (10→25) afecta a los siguientes, no a los pasados | ✅ |
| Recalificar no duplica la penalización | ✅ (ver exclusión E3) |
| Con el plugin desactivado, el comportamiento nativo queda intacto | ✅ |

*Hallazgos de esta cobertura: F20 (la detección fiable de gracia es por el evento `attempt_becameoverdue`, no por el delta temporal) y F23 (el regrade nativo restaura la nota sin penalización).*

## 4. Exclusiones justificadas (con plan manual)

| ID | Excluido | Por qué es aceptable | Plan manual |
|---|---|---|---|
| E1 | Validación visual fina del badge >3 en **múltiples temas** de Moodle | Se automatiza en el tema por defecto (Boost); el riesgo en otros temas es puramente estético | Revisión visual trimestral al cambiar de tema |
| E2 | Drag & drop del emparejamiento en **móvil** | Se cubre en desktop (mismo backend); el gesto táctil no cambia la lógica de calificación | Smoke manual en móvil por release |
| E3 | Preservación de la penalización de gracia **tras un regrade** | Limitación real documentada (F23): el evento `attempt_regraded` dispara antes de que Moodle persista `sumgrades`, por lo que re-aplicar síncronamente pierde la carrera. El criterio literal —no duplicar— se cumple y el log auditable conserva el desglose | Candidato a extensión con ad-hoc task post-regrade; el profesor revisa el log si recalifica un intento en gracia |
| E4 | **Cambios 1 y 3** del enunciado | Excluidos explícitamente por GES (correo 2026-07-10) | N/A — fuera de alcance |

## 5. Evidencia de una corrida

- Reporte HTML de Playwright con trace/video/screenshot por fallo (`playwright-report/`, artefacto de CI).
- `scripts/verify-env.sh`: 22 asserts de entorno (datos sembrados, plugins instalados, logins reales) como fail-fast previo a la suite.
- CI en dos workflows: `ci.yml` (análisis estático) + `e2e.yml` (stack → seed → suite, con reporte y logs como artefactos).
