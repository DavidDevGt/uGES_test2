<div align="center">

# 🎓 GES — Moodle QA Automatizado & Plugins

**Prueba Técnica 2 — Suite de automatización E2E y plugins locales arquitectónicos impulsados por IA.**

Un framework robusto que unifica la infraestructura efímera (Docker), desarrollo nativo de Moodle 4.5 (Hooks API) y automatización UI paralela (Playwright). Co-creado y documentado exhaustivamente bajo paradigmas AI-first.

### 🚀 [Explora el código fuente](https://github.com/DavidDevGt/uGES_test2)

[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-lightgrey.svg)](LICENSE)
![Moodle](https://img.shields.io/badge/Moodle-4.5.12-F98012?logo=moodle&logoColor=white)
![Node](https://img.shields.io/badge/node-%E2%89%A5%2022.13-339933?logo=node.js&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-1.61-2EAD33?logo=playwright&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![CI/CD](https://img.shields.io/badge/CI%2FCD-Passing-success?logo=githubactions&logoColor=white)

[Características](#-características) · [Quick start](#-quick-start) · [Arquitectura](#️-arquitectura) · [Testing](#-testing) · [CI/CD](#-cicd)

</div>

---

## ✨ Características

- 🛡️ **Plugins Arquitectónicos Moodle** — Desarrollo de `local_focusguard` (monitor de visibilidad vía AJAX/WS) y `local_graceguard` (penalización transaccional) usando los estándares modernos de Moodle 4.5 (Eventos PSR-14).
- 🎬 **Playwright Harness** — Autenticación global por rol (`storageState`), paralelismo determinístico y un Page Object Model aislado de dependencias.
- 🐳 **Infraestructura Efímera** — Stack de MariaDB + Moodle `alpine` listo para usar, impulsado por `seed.sh` (datos base idempotentes, carga vía `moosh` y APIs oficiales).
- 🤖 **Desarrollo AI-First Auditado** — Cada paso de la inteligencia artificial, decisiones, alucinaciones cazadas y soluciones (workarounds) están metódicamente registradas en [`AI_USAGE.md`](AI_USAGE.md).
- 🔒 **Endurecimiento E2E** — Desactivación de tours, sincronización de AMD build, y gestión de sesiones paralela adaptada al recolector de Moodle.
- 📉 **Pipeline GitHub Actions** — Workflows segregados: humo y análisis estático ultrarrápido (`ci.yml`) y corrida profunda E2E (`e2e.yml`).

## 🧰 Stack

**Moodle 4.5.12** (PHP 8.3) · **Playwright 1.61** · **TypeScript 7** · **Docker Compose** · **pnpm**. 
Requiere **Node ≥ 22.13**.

## 🚀 Quick Start

### Prerrequisitos
- **Node.js**: `≥ 22.13` (se recomienda usar `pnpm` o `npm`).
- **Docker** y **Docker Compose**: Para levantar la infraestructura efímera (MariaDB + Moodle Alpine).
- **Bash**: Para ejecutar los scripts de orquestación (incluido por defecto en Linux/macOS y mediante Git Bash o WSL en Windows).

### Instrucciones de despliegue paso a paso

```bash
# 1. Clonar el repositorio y entrar al directorio
git clone https://github.com/DavidDevGt/uGES_test2.git
cd uGES_test2

# 2. Instalar dependencias de automatización (Playwright)
pnpm install
# (Si no usas pnpm, puedes utilizar `npm install`)

# 3. Configurar variables de entorno y levantar la infraestructura Moodle
cp .env.example .env
docker compose up -d
# Espera alrededor de 30-60 segundos para que los contenedores inicialicen.

# 4. Sembrar datos de prueba
# Este script crea los usuarios (admin, profesores, estudiantes), configura 
# el curso (QA-EXAMS-101), compila el AMD JS de Moodle e instala los plugins.
./scripts/seed.sh
```

> [!NOTE]
> Una vez finalizado el script, la instancia de Moodle estará disponible en **http://localhost:8080**.
> **Credenciales del Administrador:** Usuario: `admin` | Contraseña: `Admin123!`

### Ejecución de Pruebas Automatizadas (Playwright)

```bash
# 1. Correr la suite E2E completa de manera desatendida
pnpm test

# 2. (Opcional) Visualizar el reporte HTML de los resultados y evidencias
pnpm exec playwright show-report
```

### Comandos útiles disponibles

| Comando                  | Qué hace                                            |
| ------------------------ | --------------------------------------------------- |
| `pnpm test`              | Corre la suite E2E en consola (headless).           |
| `pnpm test:ui`           | Abre Playwright UI Mode para depuración visual interactiva. |
| `pnpm test:ci`           | Suite E2E con reporte HTML (usado en GitHub Actions). |
| `pnpm exec playwright show-report` | Muestra el reporte HTML de la última corrida en el navegador. |
| `pnpm lint`              | Análisis estático de código TypeScript (`tsc --noEmit`). |

## 🏗️ Arquitectura

La base de código está orquestada para minimizar el *flakiness* en la validación y encapsular el desarrollo Moodle:

```
uGES_test2/
├── .github/workflows/    # CI/CD pipelines (Static, Env-smoke y Playwright)
├── e2e/                  # Harness E2E (Playwright, Fixtures, POM y Specs)
├── plugins/              # Source code de Moodle (desplegados vía bind mounts)
│   ├── local_focusguard/ # Plugin Moodle: Web Services AJAX y JS tracking
│   └── local_graceguard/ # Plugin Moodle: Modificador de calificaciones (regrade)
├── scripts/              # Utilidades de orquestación (seed.sh, verify-env.sh)
└── foundation/           # Especificaciones maestras y planificación
```

| Capa / Módulo      | Responsabilidad                                                                 |
| ------------------ | ------------------------------------------------------------------------------- |
| **Playwright E2E** | Suite TypeScript usando Fixtures (`newContextAs`) para flujos multi-rol aislados. |
| **Plugins Locales**| Inyectan lógica en Moodle sin modificar el *core*. `focusguard` expone endpoints WS. `graceguard` altera la API calificador interna. |
| **Scripts**        | Automatizan el Setup (`seed.sh`) y hacen sanity checks rápidos (`verify-env.sh`).|

### 🔄 Flujo de Autenticación E2E

Para optimizar el tiempo de corrida, los tests nunca hacen login mediante la interfaz gráfica más de una vez.

```
[ Proyecto: setup ]
  └─ Inicia sesión (1 vez) por cada rol: Admin, Teacher, Teacher2, Student1-6
       └─ Guarda las cookies de sesión en `e2e/.auth/*.json`

[ Proyecto: core / timed ]
  └─ Consumen los contexts JSON pre-autenticados
       └─ Pruebas 100% enfocadas en la lógica de negocio, ejecutadas en paralelo
```

## 🧪 Testing

- **Smoke & Integración Rápida** (`verify-env.sh`) — 22 aserciones Bash/SQL que validan BD, configuraciones, usuarios y plugins instalados sin levantar un navegador (fail-fast previo a la suite).
- **E2E** (`Playwright`) — **36 tests** que cubren los **12 flujos del scope + Cambios 2 y 4** de punta a punta, repetibles (2 corridas consecutivas verdes). Fallos capturan **Screenshot**, **Video** y **DOM Trace**. Cobertura detallada en [`docs/coverage-report.md`](docs/coverage-report.md).
- **Análisis Estático** — TypeScript check (`tsc`), PHP Lint (`php -l`), ShellCheck y Actionlint (`ci.yml`).

## 📦 CI/CD

El repositorio cuenta con dos flujos críticos definidos en [`.github/workflows/`](.github/workflows/):

- **CI General** (`ci.yml`) — Disparado en cada cambio. Corre linters y levanta la infraestructura Moodle efímera para ejecutar `verify-env.sh`.
- **E2E Suite** (`e2e.yml`) — Disparado **solo** cuando cambian las especificaciones E2E, los plugins o configuraciones del stack. Corre las pruebas de Playwright de inicio a fin para prevenir regresiones.

## 🧭 Decisiones Documentadas (Trade-offs)

Todo el desarrollo se basa en decisiones metódicamente documentadas, enfocándose en un robusto control y prevención de regresiones:

- **Imagen Docker (desviación declarada)** — El enunciado sugiere "Bitnami o la oficial". Bitnami fue retirada del catálogo gratuito de Docker Hub (2025) y `moodlehq/moodle-php-apache` no contiene Moodle; se usa `erseco/alpine-moodle` (auto-instala, trae `moosh`). Justificación completa: hallazgo F1 en [`docs/findings.md`](docs/findings.md).
- **Workarounds de Moodle 4.5 Documentados** — La bitácora [`docs/findings.md`](docs/findings.md) detalla **27 hallazgos** de discrepancia entre lo documentado y el comportamiento real: dos bugs de los cambios cazados por la propia suite (F19, F20), el borrado de password por `togglesensitive` async (F13), y la carrera del "Edit mode" del gradebook en paralelo (F21), entre otros.
- **Rendimiento de CI** — En lugar de reinstalar Moodle en múltiples jobs, todo ocurre en una máquina optimizada; un solo levantamiento de imagen procesa todo el stack.

### 📚 Documentación de entrega
- **[Walkthrough (`docs/walkthrough.md`)](docs/walkthrough.md)** — Recorrido guiado de la solución en 10 minutos.
- **[Cuenta 40h → 2h (`docs/40h-to-2h.md`)](docs/40h-to-2h.md)** — Por qué la validación manual mensual baja a ~2 h, demostrado con los cambios.
- **[Reporte de cobertura (`docs/coverage-report.md`)](docs/coverage-report.md)** — Mapa flujo → spec → assert, con exclusiones justificadas.
- **[Decisiones y dirección de IA (`docs/decisions-and-ai-direction.md`)](docs/decisions-and-ai-direction.md)** — El documento corto (entregable 5).
- **[AI Usage Log (`AI_USAGE.md`)](AI_USAGE.md)** y **[Hallazgos (`docs/findings.md`)](docs/findings.md)** — Anexos exhaustivos.
- **[Especificaciones (`SPECS.md`)](foundation/SPECS.md)** — Las reglas de negocio subyacentes.

## 📄 License

Propietario — **todos los derechos reservados** ([LICENSE](LICENSE)). Solución de una
prueba técnica **confidencial** para GES · Universidad Galileo; provista solo para
evaluación, no para reuso ni fines comerciales. © 2026 David ([@DavidDevGt](https://github.com/DavidDevGt)).
