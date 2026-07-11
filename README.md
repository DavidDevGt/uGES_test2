# Moodle QA & AI Development

Repositorio de resolución para la **Prueba Técnica 2** (Desarrollo AI-first y QA automatizado del sistema de exámenes de Moodle).

## Entorno Local

1. Copiar las variables de entorno:
   ```bash
   cp .env.example .env
   ```
2. Levantar el entorno Docker:
   ```bash
   docker compose up -d
   ```
3. Sembrar datos de prueba e instalar plugins:
   ```bash
   ./scripts/seed.sh
   ```
4. Ejecutar la suite de pruebas automatizadas:
   ```bash
   pnpm i
   pnpm test
   ```

## Documentación

- [Especificaciones y Diseño (SPECS.md)](foundation/SPECS.md)
- [Plan de Ejecución (PLAN.md)](foundation/PLAN.md)
- [Plan de Implementación](foundation/IMPLEMENTATION_PLAN.md)
- [Tareas](foundation/TASKS.md)
