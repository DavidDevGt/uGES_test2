#!/usr/bin/env bash
# reset-attempts.sh — limpieza entre corridas (SPECS.md §4.1): borra intentos, NO la config.
set -euo pipefail
cd "$(dirname "$0")/.."
export MSYS_NO_PATHCONV=1 # Git Bash: no convertir paths tipo /tmp al pasarlos a docker

set -a; [ -f .env ] && . ./.env; set +a
COURSE_SHORTNAME="${COURSE_SHORTNAME:-QA-EXAMS-101}"

moosh_() { docker compose exec -T moodle moosh -n "$@"; }
sql_value() { moosh_ sql-run "$1" 2>/dev/null | sed -n 's/.*=> *\([0-9][0-9]*\).*/\1/p' | head -n1 || true; }

COURSEID=$(sql_value "SELECT id FROM mdl_course WHERE shortname='$COURSE_SHORTNAME'")
[ -n "$COURSEID" ] || { echo "Curso $COURSE_SHORTNAME no existe (¿corriste seed.sh?)"; exit 1; }

for name in quiz-general quiz-timed; do
  qid=$(sql_value "SELECT id FROM mdl_quiz WHERE course=$COURSEID AND name='$name'")
  if [ -n "$qid" ]; then
    moosh_ quiz-delete-attempts "$qid" >/dev/null || true
    echo "intentos borrados: $name (quiz id=$qid)"
  fi
done
