#!/usr/bin/env bash
# reset-attempts.sh — limpieza entre corridas (SPECS §4.1): borra intentos, NO la config.
# Uso:
#   reset-attempts.sh                      # todos los intentos de ambos quizzes sembrados
#   reset-attempts.sh quiz-general         # solo ese quiz
#   reset-attempts.sh quiz-general student1  # solo ese (quiz, usuario) — aislamiento entre
#                                            # specs paralelos (auditoría C2): un spec nunca
#                                            # borra los intentos en vuelo de otro par.
set -euo pipefail
cd "$(dirname "$0")/.."
export MSYS_NO_PATHCONV=1 # Git Bash: no convertir paths tipo /tmp al pasarlos a docker

set -a; [ -f .env ] && . ./.env; set +a
COURSE_SHORTNAME="${COURSE_SHORTNAME:-QA-EXAMS-101}"

QUIZ_FILTER="${1:-}"
USER_FILTER="${2:-}"

moosh_() { docker compose exec -T moodle moosh -n "$@"; }
sql_value() { moosh_ sql-run "$1" 2>/dev/null | sed -n 's/.*=> *\([0-9][0-9]*\).*/\1/p' | head -n1 || true; }

COURSEID=$(sql_value "SELECT id FROM mdl_course WHERE shortname='$COURSE_SHORTNAME'")
[ -n "$COURSEID" ] || { echo "Curso $COURSE_SHORTNAME no existe (¿corriste seed.sh?)"; exit 1; }

# F15: el quiz-delete-attempts de la versión embebida de moosh NO soporta filtro
# de usuario (la doc lo lista, el binario no). Se usa la API oficial
# quiz_delete_attempt(): limpia question usages y recalcula grades. Sin || true:
# un fallo del reset debe ser ruidoso, no dejar specs corriendo sobre estado sucio.
for name in quiz-general quiz-timed quiz-autosubmit; do
  if [ -n "$QUIZ_FILTER" ] && [ "$name" != "$QUIZ_FILTER" ]; then continue; fi
  docker compose exec -T \
    -e RCOURSE="$COURSE_SHORTNAME" -e RQUIZ="$name" -e RUSER="$USER_FILTER" \
    moodle php -r '
      define("CLI_SCRIPT", 1);
      require "/var/www/html/config.php";
      require_once($CFG->dirroot . "/mod/quiz/locallib.php");
      $course = $DB->get_record("course", ["shortname" => getenv("RCOURSE")], "*", MUST_EXIST);
      $quiz = $DB->get_record("quiz", ["course" => $course->id, "name" => getenv("RQUIZ")]);
      if (!$quiz) { echo getenv("RQUIZ") . ": no existe, nada que borrar\n"; exit(0); }
      $params = ["quiz" => $quiz->id];
      if (getenv("RUSER") !== "" && getenv("RUSER") !== false) {
          $u = $DB->get_record("user", ["username" => getenv("RUSER"), "deleted" => 0], "*", MUST_EXIST);
          $params["userid"] = $u->id;
      }
      $n = 0;
      foreach ($DB->get_records("quiz_attempts", $params) as $attempt) {
          quiz_delete_attempt($attempt, $quiz);
          // Las tablas de los plugins bajo prueba no las limpia quiz_delete_attempt:
          // sin esto quedan conteos/logs huérfanos que contaminan corridas siguientes.
          $DB->delete_records("local_focusguard_counts", ["attemptid" => $attempt->id]);
          $DB->delete_records("local_graceguard_log", ["attemptid" => $attempt->id]);
          $n++;
      }
      echo getenv("RQUIZ") . ": $n intento(s) borrado(s)" . (getenv("RUSER") ? " de " . getenv("RUSER") : "") . "\n";
    '
done
