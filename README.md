<div align="center">

# 🎓 GES — Moodle QA Automatizado & Plugins

**Prueba Técnica 2 — Suite de automatización E2E y plugins locales arquitectónicos impulsados por IA.**

Un framework robusto que unifica la infraestructura efímera (Docker), desarrollo nativo de Moodle 4.5 (Hooks API) y automatización UI paralela (Playwright). Co-creado y documentado exhaustivamente bajo paradigmas AI-first.

### 🚀 [Explora el código fuente](https://github.com/DavidDevGt/uGES_test2)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
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

```bash
# 1. Instalar dependencias (Node ≥ 22.13 — ver package.json; pnpm recomendado)
pnpm install

# 2. Configurar variables de entorno y levantar la infraestructura
cp .env.example .env
docker compose up -d

# 3. Sembrar datos, compilar AMD JS y configurar la academia Moodle
./scripts/seed.sh

# 4. Correr la suite de pruebas end-to-end
pnpm test
```

| Script                   | Qué hace                                            |
| ------------------------ | --------------------------------------------------- |
| `pnpm test`              | Corre la suite E2E en consola (headless)            |
| `pnpm test:ui`           | Abre Playwright UI Mode para depuración visual      |
| `pnpm test:ci`           | Suite E2E con reporte HTML y formato GitHub         |
| `pnpm test:debug`        | Lanza los tests con el inspector adjunto            |
| `pnpm lint`              | Análisis estático TypeScript (`tsc --noEmit`)       |

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
| **Playwright E2E** | Suite TypeScript usando Fixtures (`newContextAs`) para flujos multi-rol aisaldos. |
| **Plugins Locales**| Inyectan lógica en Moodle sin modificar el *core*. `focusguard` expone endpoints WS. `graceguard` altera la API calificador interna. |
| **Scripts**        | Automatizan el Setup (`seed.sh`) y hacen sanity checks rápidos (`verify-env.sh`).|

### 🔄 Flujo de Autenticación E2E

Para optimizar el tiempo de corrida, los tests nunca hacen login mediante la interfaz gráfica más de una vez.

```
[ Proyecto: setup ]
  └─ Inicia sesión (1 vez) por cada rol: Admin, Teacher, Student1, Student2
       └─ Guarda las cookies de sesión en `e2e/.auth/*.json`

[ Proyecto: core / timed ]
  └─ Consumen los contexts JSON pre-autenticados
       └─ Pruebas 100% enfocadas en la lógica de negocio, ejecutadas en paralelo
```

## 🧪 Testing

- **Smoke & Integración Rápida** (`verify-env.sh`) — 17 aserciones Bash/SQL ultrarrápidas (1.5s) que validan BD, configuraciones, usuarios y compilación de plugins sin levantar un navegador.
- **E2E Visual** (`Playwright`) — Cubre los flujos críticos funcionales de la toma y calificación de exámenes. Fallos capturan **Screenshot**, **Video** y **DOM Trace**.
- **Análisis Estático** — TypeScript check (`tsc`), PHP Lint (`php -l`), ShellCheck y Actionlint (`ci.yml`).

## 📦 CI/CD

El repositorio cuenta con dos flujos críticos definidos en [`.github/workflows/`](.github/workflows/):

- **CI General** (`ci.yml`) — Disparado en cada cambio. Corre linters y levanta la infraestructura Moodle efímera para ejecutar `verify-env.sh`.
- **E2E Suite** (`e2e.yml`) — Disparado **solo** cuando cambian las especificaciones E2E, los plugins o configuraciones del stack. Corre las pruebas de Playwright de inicio a fin para prevenir regresiones.

## 🧭 Decisiones Documentadas (Trade-offs)

Todo el desarrollo se basa en decisiones metódicamente documentadas, enfocándose en un robusto control y prevención de regresiones:

- **Workarounds de Moodle 4.5 Documentados** — En la bitácora `docs/findings.md` se detallan 13 hallazgos críticos de Moodle, incluyendo el uso de `user-menu-toggle`, los problemas de caché de JS asíncrono, y las caídas por bloqueo transaccional de bases de datos.
- **Rendimiento de CI** — En lugar de reinstalar Moodle en múltiples jobs, todo ocurre en una máquina optimizada; un solo levantamiento de imagen procesa todo el stack.

### 📚 Documentación adicional
- **[AI Usage Log (`AI_USAGE.md`)](AI_USAGE.md)** — Reporte exhaustivo de participación de la IA (qué hizo y cómo se mitigaron sus errores).
- **[Especificaciones (`SPECS.md`)](foundation/SPECS.md)** — Las reglas de negocio subyacentes.

## 📄 License

[MIT](LICENSE) © David ([@DavidDevGt](https://github.com/DavidDevGt))
