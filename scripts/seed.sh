#!/usr/bin/env bash
# seed.sh — datos base idempotentes (SPECS.md §1.2)
# Correrlo dos veces no duplica ni falla. Imprime resumen con ids y termina con exit code correcto.
set -euo pipefail
cd "$(dirname "$0")/.."

# Git Bash (Windows) convierte /tmp/... en C:/Users/... al pasar args a docker
# (hallazgo 2026-07-11). Desactivar la conversión de paths de MSYS; no-op en Linux/macOS.
export MSYS_NO_PATHCONV=1

set -a; [ -f .env ] && . ./.env; set +a

COURSE_SHORTNAME="${COURSE_SHORTNAME:-QA-EXAMS-101}"
COURSE_FULLNAME="QA Exams 101"
CATEGORY_NAME="QA"

moosh_() { docker compose exec -T moodle moosh -n "$@"; }

# Devuelve el valor numérico del primer campo de la primera fila de un SELECT (o vacío).
# La salida de sql-run es print_r: "Record N / stdClass Object ( [campo] => valor )" —
# hay que leer el valor tras "=>", no el primer número (que sería el contador "Record 1").
sql_value() {
  moosh_ sql-run "$1" 2>/dev/null | sed -n 's/.*=> *\([0-9][0-9]*\).*/\1/p' | head -n1 || true
}

wait_moodle() {
  echo "==> Esperando a que Moodle esté healthy..."
  local cid; cid=$(docker compose ps -q moodle)
  for _ in $(seq 1 80); do
    local st; st=$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo starting)
    [ "$st" = "healthy" ] && { echo "    Moodle healthy."; return 0; }
    sleep 5
  done
  echo "ERROR: Moodle no llegó a healthy (docker compose logs moodle)"; exit 1
}

ensure_user() { # username pass firstname lastname
  local u="$1" p="$2" fn="$3" ln="$4"
  local uid; uid=$(sql_value "SELECT id FROM mdl_user WHERE username='$u' AND deleted=0")
  if [ -z "$uid" ]; then
    moosh_ user-create --password "$p" --email "$u@example.com" --firstname "$fn" --lastname "$ln" --city QA "$u" >/dev/null
    uid=$(sql_value "SELECT id FROM mdl_user WHERE username='$u' AND deleted=0")
    echo "    usuario $u creado (id=$uid)"
  else
    echo "    usuario $u ya existe (id=$uid)"
  fi
}

wait_moodle

# Sin grunt en este entorno: Moodle en producción sirve AMD desde amd/build/*.min.js.
# Sincronizar src → build en cada seed elimina el riesgo de drift (revisión M1);
# la purga de caches del final hace que Moodle recoja la versión nueva.
echo "==> Sincronizando builds AMD (src → build)"
for d in plugins/*/amd; do
  [ -d "$d/src" ] || continue
  mkdir -p "$d/build"
  for f in "$d"/src/*.js; do
    [ -e "$f" ] || continue
    cp "$f" "$d/build/$(basename "$f" .js).min.js"
  done
done

echo "==> Instalando/actualizando plugins locales (upgrade.php es idempotente)"
docker compose exec -T moodle php /var/www/html/admin/cli/upgrade.php --non-interactive >/dev/null

echo "==> Categoría de cursos '$CATEGORY_NAME'"
CATID=$(sql_value "SELECT id FROM mdl_course_categories WHERE name='$CATEGORY_NAME'")
if [ -z "$CATID" ]; then
  moosh_ category-create "$CATEGORY_NAME" >/dev/null
  CATID=$(sql_value "SELECT id FROM mdl_course_categories WHERE name='$CATEGORY_NAME'")
  echo "    creada (id=$CATID)"
else
  echo "    ya existe (id=$CATID)"
fi

echo "==> Curso $COURSE_SHORTNAME"
COURSEID=$(sql_value "SELECT id FROM mdl_course WHERE shortname='$COURSE_SHORTNAME'")
if [ -z "$COURSEID" ]; then
  moosh_ course-create --category "$CATID" --fullname "$COURSE_FULLNAME" --visible y "$COURSE_SHORTNAME" >/dev/null
  COURSEID=$(sql_value "SELECT id FROM mdl_course WHERE shortname='$COURSE_SHORTNAME'")
  echo "    creado (id=$COURSEID)"
else
  echo "    ya existe (id=$COURSEID)"
fi

echo "==> Usuarios"
ensure_user "${TEACHER_USER:-teacher1}"  "${TEACHER_PASS:-Teacher123!}"  "Tina"  "Teacher"
ensure_user "${STUDENT1_USER:-student1}" "${STUDENT1_PASS:-Student123!}" "Sam"   "StudentOne"
ensure_user "${STUDENT2_USER:-student2}" "${STUDENT2_PASS:-Student123!}" "Sara"  "StudentTwo"

# Matriculaciones: las hace seed-course-setup.php vía API
# (hallazgo 2026-07-11: moosh course-enrol es incompatible con Moodle 4.5 — pierde \$CFG->dirroot).

echo "==> Categoría de preguntas SEED (contexto del curso)"
CTXID=$(sql_value "SELECT id FROM mdl_context WHERE contextlevel=50 AND instanceid=$COURSEID")
QCATID=$(sql_value "SELECT id FROM mdl_question_categories WHERE name='SEED' AND contextid=$CTXID")
if [ -z "$QCATID" ]; then
  moosh_ questioncategory-create -c "$CTXID" -r SEED >/dev/null
  QCATID=$(sql_value "SELECT id FROM mdl_question_categories WHERE name='SEED' AND contextid=$CTXID")
  echo "    creada (id=$QCATID)"
else
  echo "    ya existe (id=$QCATID)"
fi

echo "==> Banco de preguntas SEED-*"
NQ=$(sql_value "SELECT COUNT(*) FROM mdl_question WHERE name LIKE 'SEED-%'")
if [ "${NQ:-0}" -ge 6 ]; then
  echo "    banco base ya importado"
else
  docker compose cp scripts/seed-questions.xml moodle:/tmp/seed-questions.xml >/dev/null
  # Sintaxis moosh: questionbank-import <archivo> <id categoría de preguntas>
  moosh_ questionbank-import /tmp/seed-questions.xml "$QCATID"
fi

# Pool de reserva para el slot aleatorio (F14: la aleatoria excluye las preguntas
# ya fijas en el mismo quiz — sin reserva, el pool queda vacío y el intento no inicia).
NEXTRA=$(sql_value "SELECT COUNT(*) FROM mdl_question WHERE name IN ('SEED-MC-02','SEED-TF-02')")
if [ "${NEXTRA:-0}" -ge 2 ]; then
  echo "    pool de reserva ya importado"
else
  docker compose cp scripts/seed-questions-extra.xml moodle:/tmp/seed-questions-extra.xml >/dev/null
  moosh_ questionbank-import /tmp/seed-questions-extra.xml "$QCATID"
fi
NQ=$(sql_value "SELECT COUNT(*) FROM mdl_question WHERE name LIKE 'SEED-%'")
echo "    $NQ preguntas SEED- en el banco (6 base + 2 reserva)"

ensure_quiz() { # name section
  local name="$1" section="$2"
  local qid; qid=$(sql_value "SELECT id FROM mdl_quiz WHERE course=$COURSEID AND name='$name'")
  if [ -z "$qid" ]; then
    moosh_ activity-add --name "$name" --section "$section" quiz "$COURSEID" >/dev/null
    qid=$(sql_value "SELECT id FROM mdl_quiz WHERE course=$COURSEID AND name='$name'")
    echo "    quiz $name creado (id=$qid)"
  else
    echo "    quiz $name ya existe (id=$qid)"
  fi
}

echo "==> Quizzes"
ensure_quiz "quiz-general" 1
ensure_quiz "quiz-timed" 1
QUIZGEN=$(sql_value "SELECT id FROM mdl_quiz WHERE course=$COURSEID AND name='quiz-general'")
QUIZTIMED=$(sql_value "SELECT id FROM mdl_quiz WHERE course=$COURSEID AND name='quiz-timed'")

# quiz-timed: límite 2 min, gracia 2 min, 2 intentos, nota más alta (D4).
# Gracia 120s (no el mínimo de 60s): la ventana de envío en gracia debe ser holgada
# en runners de CI cargados (auditoría C5); sigue siendo un timer corto.
moosh_ sql-run "UPDATE mdl_quiz SET timelimit=120, overduehandling='graceperiod', graceperiod=120, attempts=2, grademethod=1 WHERE id=$QUIZTIMED" >/dev/null
# quiz-general: sin límite, intentos ilimitados
moosh_ sql-run "UPDATE mdl_quiz SET timelimit=0, attempts=0 WHERE id=$QUIZGEN" >/dev/null

echo "==> Matriculaciones + preguntas en quizzes (API Moodle)"
docker compose cp scripts/seed-course-setup.php moodle:/tmp/seed-course-setup.php >/dev/null
docker compose exec -T moodle php /tmp/seed-course-setup.php \
  --shortname="$COURSE_SHORTNAME" \
  --teacher="${TEACHER_USER:-teacher1}" \
  --students="${STUDENT1_USER:-student1},${STUDENT2_USER:-student2}"

echo "==> Endurecimiento para E2E: deshabilitar user tours (diálogos de onboarding rompen los tests)"
moosh_ sql-run "UPDATE mdl_tool_usertours_tours SET enabled=0" >/dev/null

echo "==> Purga de caches"
moosh_ cache-clear >/dev/null || moosh_ purge-caches >/dev/null || true

echo ""
echo "=========== RESUMEN SEED ==========="
echo " categoria   : $CATEGORY_NAME (id=$CATID)"
echo " curso       : $COURSE_SHORTNAME (id=$COURSEID)"
echo " usuarios    : ${TEACHER_USER:-teacher1}, ${STUDENT1_USER:-student1}, ${STUDENT2_USER:-student2}"
echo " preguntas   : $NQ con prefijo SEED-"
echo " quiz-general: id=$QUIZGEN (sin límite)"
echo " quiz-timed  : id=$QUIZTIMED (120s + gracia 120s, 2 intentos, nota más alta)"
echo "===================================="
