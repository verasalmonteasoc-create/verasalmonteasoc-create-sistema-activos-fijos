#!/usr/bin/env bash
# Sube los cambios locales del proyecto a GitHub.
# Ejecutar desde la raíz del repo: bash scripts/push_to_git.sh "mensaje de commit"
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

BRANCH="$(git branch --show-current)"
MSG="${1:-Actualización del sistema de activos fijos}"

echo "== Rama actual: $BRANCH =="
git status --short

# Solo se agregan archivos de código del proyecto. NO se incluyen:
# - .env (credenciales, ya está en .gitignore)
# - logs sueltos, exports de Excel de trabajo, ni la carpeta "Activos  Fijos"
#   anidada que no pertenece al repo principal.
git add \
    backend/ \
    frontend/ \
    docker/ \
    deploy/ \
    scripts/ \
    docker-compose.yml \
    docker-compose.prod.yml \
    Dockerfile \
    requirements.txt \
    .env.example \
    .gitignore

echo ""
echo "== Cambios que se van a commitear =="
git status --short

read -p "¿Confirmas el commit y push a origin/$BRANCH? (s/N) " CONFIRM
if [[ "$CONFIRM" != "s" && "$CONFIRM" != "S" ]]; then
    echo "Cancelado. No se hizo commit ni push."
    exit 1
fi

git commit -m "$MSG"
git push origin "$BRANCH"

echo ""
echo "✓ Cambios subidos a origin/$BRANCH"
