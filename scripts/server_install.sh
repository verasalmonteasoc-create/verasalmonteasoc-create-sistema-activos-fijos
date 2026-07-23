#!/usr/bin/env bash
#
# Instalación / actualización del Sistema de Activos Fijos en un servidor Ubuntu.
#
# Qué hace:
#   1. Instala Docker Engine + plugin de Docker Compose (si no están ya instalados).
#   2. Clona el repo la primera vez, o hace "git pull" en corridas siguientes.
#   3. Genera un .env de producción la primera vez (SECRET_KEY y password de
#      BD aleatorios) — en corridas siguientes lo respeta tal cual.
#   4. Levanta los contenedores propios del proyecto (docker-compose.prod.yml):
#      Postgres (sin exponer puerto al host) + Flask/Gunicorn (solo en
#      127.0.0.1:APP_PORT). No toca ningún otro contenedor/proyecto que ya
#      corra en el servidor.
#   5. Instala el server block de nginx para af.aplicacioneard.com y hace
#      "nginx -t" + reload. No genera nada de SSL (eso lo haces tú con
#      certbot, ver el paso manual al final).
#
# Uso (en el servidor Ubuntu, con sudo):
#   sudo bash scripts/server_install.sh
#
# Es seguro volver a ejecutarlo para desplegar actualizaciones (hace git pull
# + reconstruye la imagen + reinicia los contenedores).

set -euo pipefail

# ========== CONFIGURACIÓN — AJUSTA SI HACE FALTA ==========
REPO_URL="https://github.com/verasalmonteasoc-create/sistema-activos-fijos.git"
APP_DIR="/opt/af-activos-fijos"
DOMAIN="af.aplicacioneard.com"
APP_PORT="8010"   # Puerto local (127.0.0.1) donde el backend queda expuesto.
                   # Cámbialo aquí y en deploy/nginx-af.aplicacioneard.com.conf
                   # si ya está en uso por el otro proyecto (revisa con: ss -tlnp).
BRANCH="master"
# ============================================================

if [[ $EUID -ne 0 ]]; then
    echo "Este script necesita sudo. Ejecuta: sudo bash $0"
    exit 1
fi

echo "== 1/6: Paquetes base (git, curl) =="
apt-get update -y
apt-get install -y git curl ca-certificates gnupg

echo "== 2/6: Docker Engine + Compose plugin =="
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

echo "== 3/6: Código de la aplicación en ${APP_DIR} =="
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

echo "== 4/6: Archivo .env de producción =="
if [[ ! -f .env ]]; then
    echo "No existe .env, generando uno nuevo con credenciales aleatorias..."
    SECRET_KEY="$(openssl rand -hex 32)"
    DB_PASSWORD="$(openssl rand -hex 16)"
    cat > .env <<EOF
FLASK_ENV=production
DEBUG=False

APP_BASE_URL=https://${DOMAIN}
APP_PORT=${APP_PORT}

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
    echo "✓ .env creado. Guarda una copia de este archivo en un lugar seguro (contiene la contraseña de la BD)."
else
    echo ".env ya existe, se respeta tal cual (no se sobrescribe)."
fi

echo "== 5/6: Levantando contenedores (Postgres + Backend) =="
docker compose -f docker-compose.prod.yml up -d --build

echo "Esperando a que el backend responda en 127.0.0.1:${APP_PORT}/health..."
for i in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:${APP_PORT}/health" > /dev/null 2>&1; then
        echo "✓ Backend respondiendo correctamente."
        break
    fi
    sleep 2
    if [[ "$i" -eq 30 ]]; then
        echo "⚠ El backend no respondió a tiempo. Revisa los logs con:"
        echo "  docker compose -f ${APP_DIR}/docker-compose.prod.yml logs -f backend"
    fi
done

echo "== 6/6: Configurando nginx para ${DOMAIN} =="

# Ubicar el nginx.conf principal (respeta instalaciones no estándar).
NGINX_CONF="$(nginx -V 2>&1 | tr ' ' '\n' | sed -n 's/^--conf-path=//p')"
NGINX_CONF="${NGINX_CONF:-/etc/nginx/nginx.conf}"
NGINX_ROOT="$(dirname "$NGINX_CONF")"
echo "nginx.conf principal: ${NGINX_CONF}"

TARGET_DIR=""
USE_SYMLINK="no"

if [[ -d "${NGINX_ROOT}/sites-available" && -d "${NGINX_ROOT}/sites-enabled" ]]; then
    # Layout Debian/Ubuntu clásico
    TARGET_DIR="${NGINX_ROOT}/sites-enabled"
    USE_SYMLINK="yes"
elif [[ -d "${NGINX_ROOT}/conf.d" ]]; then
    TARGET_DIR="${NGINX_ROOT}/conf.d"
elif [[ -d "${NGINX_ROOT}/http.d" ]]; then
    # Layout Alpine
    TARGET_DIR="${NGINX_ROOT}/http.d"
else
    # Fallback: deducir el directorio de include real leyendo la config
    # efectiva. Busca un "include .../*.conf;" dentro del bloque http.
    DETECTED="$(nginx -T 2>/dev/null \
        | grep -oE 'include[[:space:]]+\S+\*(\.conf)?;' \
        | grep -vE 'mime\.types|modules|fastcgi|scgi|uwsgi|proxy_params' \
        | head -1 \
        | sed -E 's/^include[[:space:]]+//; s/;$//; s#/[^/]*\*[^/]*$##')"
    if [[ -n "${DETECTED}" && -d "${DETECTED}" ]]; then
        TARGET_DIR="${DETECTED}"
    fi
fi

if [[ -z "${TARGET_DIR}" ]]; then
    echo "⚠ No pude detectar automáticamente el directorio de includes de nginx."
    echo "  Layout de ${NGINX_ROOT}:"
    ls -la "${NGINX_ROOT}" || true
    echo ""
    echo "  Copia manualmente el server block e inclúyelo donde corresponda:"
    echo "    sudo cp ${APP_DIR}/deploy/nginx-${DOMAIN}.conf <dir-de-includes>/${DOMAIN}.conf"
    echo "    sudo nginx -t && sudo systemctl reload nginx"
    exit 1
fi

echo "Directorio de includes detectado: ${TARGET_DIR}"
cp "deploy/nginx-${DOMAIN}.conf" "${TARGET_DIR}/${DOMAIN}.conf"
if [[ "${USE_SYMLINK}" == "yes" ]]; then
    cp "deploy/nginx-${DOMAIN}.conf" "${NGINX_ROOT}/sites-available/${DOMAIN}.conf"
    ln -sf "${NGINX_ROOT}/sites-available/${DOMAIN}.conf" "${TARGET_DIR}/${DOMAIN}.conf"
fi
nginx -t
systemctl reload nginx

echo ""
echo "================================================================"
echo " ✓ Despliegue completo."
echo "================================================================"
echo ""
echo "PASOS MANUALES (solo la primera vez):"
echo ""
echo "1. Verifica que el DNS de ${DOMAIN} ya apunte a la IP de este servidor:"
echo "     dig +short ${DOMAIN}"
echo ""
echo "2. Emite el certificado SSL con tu certbot ya configurado:"
echo "     sudo certbot --nginx -d ${DOMAIN}"
echo ""
echo "3. Prueba el sitio:"
echo "     https://${DOMAIN}"
echo ""
echo "Para desplegar actualizaciones futuras, vuelve a correr:"
echo "  sudo bash ${APP_DIR}/scripts/server_install.sh"
echo "================================================================"
