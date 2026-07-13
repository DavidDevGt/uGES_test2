#!/usr/bin/env bash
# flake-check.sh — mide el Flake Rate de la suite (criterio "estable, no flaky").
#   Flake Rate = (fallos intermitentes / ejecuciones totales) × 100
# Corre la suite completa N veces consecutivas SIN intervención (los specs se
# auto-resetean en beforeAll) y reporta qué tests fallaron en qué corridas.
#
# Uso: ./scripts/flake-check.sh [N]   (default: 3)
# Sin -e a propósito: una corrida fallida no debe abortar la medición.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

RUNS="${1:-3}"
OUTDIR=".flake-check"
rm -rf "$OUTDIR" && mkdir -p "$OUTDIR"

declare -a RESULTS

for i in $(seq 1 "$RUNS"); do
  echo "==> Corrida $i/$RUNS ($(date +%H:%M:%S))"
  if pnpm test --reporter=list > "$OUTDIR/run-$i.log" 2>&1; then
    RESULTS[$i]="PASS"
    echo "    ✅ $(grep -Eo '[0-9]+ passed \([0-9.]+m?s?\)' "$OUTDIR/run-$i.log" | tail -1)"
  else
    RESULTS[$i]="FAIL"
    echo "    ❌ fallos:"
    grep -E '^\s+\[.*›' "$OUTDIR/run-$i.log" | grep -v ' ok ' | sed 's/^/       /' | head -8
  fi
done

echo ""
echo "=========== FLAKE RATE ==========="
FAILS=0
for i in $(seq 1 "$RUNS"); do
  echo " corrida $i: ${RESULTS[$i]}"
  [ "${RESULTS[$i]}" = "FAIL" ] && FAILS=$((FAILS + 1))
done
RATE=$(( FAILS * 100 / RUNS ))
echo " ----------------------------------"
echo " Flake Rate de suite: $FAILS/$RUNS corridas con fallos = ${RATE}%"
echo ""
echo " Tests que fallaron alguna vez (candidatos flaky):"
grep -hE '^\s{4}\[(core|timed|setup)\]' "$OUTDIR"/run-*.log 2>/dev/null | sort | uniq -c | sort -rn | head -10 || echo "   (ninguno)"
echo "=================================="
echo " Logs completos en $OUTDIR/run-N.log"
[ "$FAILS" -eq 0 ]
