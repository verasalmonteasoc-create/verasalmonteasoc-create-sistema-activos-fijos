#!/usr/bin/env bash
#
# Instalación / actualización del Sistema de Activos Fijos en un servidor Ubuntu.
#
# Stack 100% autocontenido y aislado del resto: Postgres + Flask/Gunicorn +
# nginx propio + certbot propio, todo en su propia red Docker. NO toca ningún
# otro contenedor/proyecto del servidor. El nginx de ESTE stack escucha en
# puertos ALTERNOS del host (8080/8443) para no chocar con el que ya usa 80/443.
#
# Qué hace:
#   1. Instala Docker Engine + Compose plugin (si no están ya instalados).
#   2. Clona el repo la primera vez, o hace "git pull" en corridas siguientes.
#   3. Genera un .env de producción la primera vez (SECRET_KEY y password de BD
#      aleatorios) — en corridas siguientes lo respeta tal cual.
#   4. Levanta el stack (docker-compose.prod.yml) y verifica que responda.
#
# Uso (en el servidor Ubuntu, con sudo):
#   sudo bash scripts/server_install.sh
#
# Es seguro volver a ejecutarlo para desplegar actualizaciones.

set -euo pipefail

# ========== CONFIGURACIÓN — AJUSTA SI HACE FALTA ==========
REPO_URL="https://github.com/verasalmonteasoc-create/sistema-activos-fijos.git"
APP_DIR="/opt/af-activos-fijos"
DOMAIN="af.aplicacioneard.com"
HTTP_PORT="8080"    # Puerto HTTP del host para el nginx de este stack.
HTTPS_PORT="8443"   # Puerto HTTPS del host para el nginx de este stack.
                    # Cámbialos si ya están ocupados (revisa con: ss -tlnp).
BRANCH="master"
# ============================================================

if [[ $EUID -ne 0 ]]; then
    echo "Este script necesita sudo. Ejecuta: sudo bash $0"
    exit 1
fi

echo "== 1/5: Paquetes base (git, curl) =="
apt-get update -y
apt-get install -y git curl ca-certificates gnupg

echo "== 2/5: Docker Engine + Compose plugin =="
if ! command -v docker &> /dev/null; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    ARCH="$(dpkg --print-architecture)"
    CODENAME="$(. /etc/os-release && echo "$VERSION_CODENAME")"
    echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${CODENAME} stable" \
        > /etc/apt/sources.list.d/docker.list
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable --now docker
else
    echo "Docker ya está instalado, no se toca (así no afecta al otro proyecto)."
fi

echo "== 3/5: Código de la aplicación en ${APP_DIR} =="
if [[ -d "${APP_DIR}/.git" ]]; then
    echo "Repo ya existe, actualizando (git pull)..."
    git -C "${APP_DIR}" fetch origin
    git -C "${APP_DIR}" checkout "${BRANCH}"
    git -C "${APP_DIR}" pull origin "${BRANCH}"
else
    echo "Clonando repo por primera vez..."
    git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
fi
cd "${APP_DIR}"

echo "== 4/5: Archivo .env de producción =="
if [[ ! -f .env ]]; then
    echo "No existe .env, generando uno nuevo con credenciales aleatorias..."
    SECRET_KEY="$(openssl rand -hex 32)"
    DB_PASSWORD="$(openssl rand -hex 16)"
    cat > .env <<EOF
FLASK_ENV=production
DEBUG=False

DOMAIN=${DOMAIN}
APP_BASE_URL=https://${DOMAIN}
HTTP_PORT=${HTTP_PORT}
HTTPS_PORT=${HTTPS_PORT}

DB_HOST=postgres
DB_PORT=5432
DB_NAME=asset_management
DB_USER=postgres
DB_PASSWORD=${DB_PASSWORD}

SECRET_KEY=${SECRET_KEY}
SESSION_COOKIE_SECURE=True
CORS_ORIGINS=https://${DOMAIN}

UPLOAD_FOLDER=backend/uploads
MAX_CONTENT_LENGTH=52428800

LOG_LEVEL=INFO
LOG_TO_STDOUT=True
MAINTENANCE_MODE=False
EOF
    chmod 600 .env
    echo "✓ .env creado. Guarda una copia en un lugar seguro (contiene la contraseña de la BD)."
else
    echo ".env ya existe, se respeta tal cual (no se sobrescribe)."
fi

echo "== 5/5: Levantando el stack (Postgres + Backend + nginx + certbot) =="
docker compose -f docker-compose.prod.yml up -d --build

echo "Esperando a que el sitio responda en https://127.0.0.1:${HTTPS_PORT}/health..."
OK="no"
for i in $(seq 1 30); do
    if curl -fsSk "https://127.0.0.1:${HTTPS_PORT}/health" > /dev/null 2>&1; then
        echo "✓ El stack responde correctamente (nginx -> backend)."
        OK="yes"
        break
    fi
    sleep 2
done
if [[ "${OK}" != "yes" ]]; then
    echo "⚠ El stack no respondió a tiempo. Revisa los logs con:"
    echo "  docker compose -f ${APP_DIR}/docker-compose.prod.yml logs -f"
fi

echo ""
echo "================================================================"
echo " ✓ Stack desplegado y aislado."
echo "================================================================"
echo ""
echo "Este stack escucha en el host en:"
echo "   HTTP :  http://127.0.0.1:${HTTP_PORT}   (redirige a HTTPS)"
echo "   HTTPS:  https://127.0.0.1:${HTTPS_PORT}  (certificado AUTOFIRMADO por ahora)"
echo ""
echo "PASOS PARA DEJARLO PÚBLICO EN https://${DOMAIN} :"
echo ""
echo "1. El puerto 443 público lo tiene tesoreria-nginx. Como este stack usa"
echo "   ${HTTPS_PORT}, el tráfico de ${DOMAIN} debe llegar aquí. Elige una:"
echo "     a) Enrutar ${DOMAIN} desde tu proxy tesoreria-nginx hacia"
echo "        https://127.0.0.1:${HTTPS_PORT} (o el nombre de red de este nginx)."
echo "     b) O exponer directamente los puertos ${HTTP_PORT}/${HTTPS_PORT} y"
echo "        apuntar el DNS/entrada a ellos."
echo ""
echo "2. Emitir el certificado REAL de Let's Encrypt (reemplaza el autofirmado):"
echo "     sudo bash ${APP_DIR}/scripts/issue_cert.sh tu-correo@dominio.com"
echo "   (lee ese script: la validación necesita que el ACME del dominio llegue"
echo "    a este stack, o usar el modo DNS-01 que ahí se explica)."
echo ""
echo "Para actualizaciones futuras, vuelve a correr:"
echo "  sudo bash ${APP_DIR}/scripts/server_install.sh"
echo "================================================================"
