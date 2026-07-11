#!/usr/bin/env bash
# verify-env.sh — smoke test automatizado del entorno (criterios de SPECS.md §1.2).
# Valida: seed idempotente (2 corridas), datos sembrados vía SQL, settings de quizzes
# y autenticación real de los 4 roles. Exit != 0 si cualquier assert falla.
# Se usa localmente y en CI (.github/workflows/e2e.yml).
set -euo pipefail
cd "$(dirname "$0")/.."
export MSYS_NO_PATHCONV=1

# shellcheck disable=SC1091
set -a; [ -f .env ] && . ./.env; set +a

moosh_() { docker compose exec -T moodle moosh -n "$@"; }
sql_num() { moosh_ sql-run "$1" 2>/dev/null | sed -n 's/.*=> *\([0-9][0-9.]*\).*/\1/p' | head -n1 || true; }
sql_str() { moosh_ sql-run "$1" 2>/dev/null | sed -n 's/.*\[[^]]*\] => *\(.*\)$/\1/p' | head -n1 || true; }

PASS=0; FAIL=0
check() { # descripcion actual esperado
  if [ "${2:-}" = "$3" ]; then
    echo "  ok   $1 = $2"; PASS=$((PASS + 1))
  else
    echo "  FAIL $1 (esperado='$3', real='${2:-<vacio>}')"; FAIL=$((FAIL + 1))
  fi
}

echo "==> [1/4] seed.sh corrida 1"
bash scripts/seed.sh >/dev/null

echo "==> [2/4] seed.sh corrida 2 (idempotencia: no debe duplicar ni fallar)"
bash scripts/seed.sh >/dev/null

echo "==> [3/4] Asserts de datos sembrados (SQL directo)"
check "usuarios de prueba" \
  "$(sql_num "SELECT COUNT(*) FROM mdl_user WHERE username IN ('teacher1','student1','student2') AND deleted=0")" "3"
check "matriculados en QA-EXAMS-101" \
  "$(sql_num "SELECT COUNT(DISTINCT ue.userid) FROM mdl_user_enrolments ue JOIN mdl_enrol e ON e.id=ue.enrolid JOIN mdl_course c ON c.id=e.courseid WHERE c.shortname='${COURSE_SHORTNAME:-QA-EXAMS-101}'")" "3"
check "preguntas SEED- (sin duplicados)" \
  "$(sql_num "SELECT COUNT(*) FROM mdl_question WHERE name LIKE 'SEED-%'")" "6"
check "slots de quiz-general (6 fijas + 1 aleatoria)" \
  "$(sql_num "SELECT COUNT(*) FROM mdl_quiz_slots s JOIN mdl_quiz q ON q.id=s.quizid WHERE q.name='quiz-general'")" "7"
check "slots de quiz-timed" \
  "$(sql_num "SELECT COUNT(*) FROM mdl_quiz_slots s JOIN mdl_quiz q ON q.id=s.quizid WHERE q.name='quiz-timed'")" "2"
check "quiz-timed timelimit" \
  "$(sql_num "SELECT timelimit FROM mdl_quiz WHERE name='quiz-timed'")" "120"
check "quiz-timed graceperiod" \
  "$(sql_num "SELECT graceperiod FROM mdl_quiz WHERE name='quiz-timed'")" "60"
check "quiz-timed overduehandling" \
  "$(sql_str "SELECT overduehandling FROM mdl_quiz WHERE name='quiz-timed'")" "graceperiod"
check "quiz-timed intentos permitidos" \
  "$(sql_num "SELECT attempts FROM mdl_quiz WHERE name='quiz-timed'")" "2"

echo "==> [4/4] Autenticación real por rol (authenticate_user_login)"
login_check() { # username password
  if docker compose exec -T -e VU="$1" -e VP="$2" moodle php -r \
    'define("CLI_SCRIPT",1); require "/var/www/html/config.php"; exit(authenticate_user_login(getenv("VU"), getenv("VP")) ? 0 : 1);' \
    >/dev/null 2>&1; then
    echo "  ok   login $1"; PASS=$((PASS + 1))
  else
    echo "  FAIL login $1"; FAIL=$((FAIL + 1))
  fi
}
login_check "${MOODLE_ADMIN_USER:-admin}"   "${MOODLE_ADMIN_PASS:-Admin123!}"
login_check "${TEACHER_USER:-teacher1}"     "${TEACHER_PASS:-Teacher123!}"
login_check "${STUDENT1_USER:-student1}"    "${STUDENT1_PASS:-Student123!}"
login_check "${STUDENT2_USER:-student2}"    "${STUDENT2_PASS:-Student123!}"

echo ""
echo "=========== VERIFY-ENV: $PASS ok, $FAIL fail ==========="
[ "$FAIL" -eq 0 ]
