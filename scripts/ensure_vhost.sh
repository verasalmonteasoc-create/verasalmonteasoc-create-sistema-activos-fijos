#!/usr/bin/env bash
#
# Mantiene vivo el acceso público a https://af.aplicacionesrd.com.
#
# ¿POR QUÉ EXISTE ESTE SCRIPT?
# El puerto 443 del servidor lo posee el nginx del OTRO proyecto
# (tesoreria-nginx, de GestionCxC). Para que nuestro dominio entre por ahí, se
# agregó una línea `include /etc/letsencrypt/af-vhost/*.conf;` a su nginx.conf.
# Cuando ese proyecto se redespliega, regenera su nginx.conf y BORRA esa línea:
# entonces el 443 empieza a responder con el certificado de cxc y nuestro sitio
# queda inaccesible ("La conexión no es privada").
#
# Este script detecta esa situación y la repara solo. Es idempotente: si todo
# está bien, no toca nada.
#
# USO
#   sudo bash scripts/ensure_vhost.sh            # verifica y repara
#   sudo bash scripts/ensure_vhost.sh --check    # solo diagnostica, no cambia nada
#
# AUTOMATIZARLO (recomendado) — revisa cada 10 minutos:
#   sudo crontab -e
#   */10 * * * * /bin/bash /opt/af-activos-fijos/scripts/ensure_vhost.sh >> /var/log/af-vhost.log 2>&1
#
# NOTA: si falta el `include`, la única forma de que el contenedor lea el
# nginx.conf corregido es reiniciarlo (su nginx.conf está montado como archivo
# de solo lectura). Eso corta ~5 segundos el sitio de tesorería. El script solo
# lo hace cuando nuestro sitio YA está caído, así que el reinicio es la cura.

set -uo pipefail

# ========== CONFIGURACIÓN ==========
APP_DIR="${APP_DIR:-/opt/af-activos-fijos}"
GESTION_DIR="${GESTION_DIR:-/home/edwin/GestionCxC}"
PROXY="${PROXY:-tesoreria-nginx}"
DOMAIN="${DOMAIN:-af.aplicacionesrd.com}"
LE_VOLUME="af-activos-fijos_af_activos_letsencrypt"
# ===================================

CHECK_ONLY="no"
[[ "${1:-}" == "--check" ]] && CHECK_ONLY="yes"

VHOST_DIR="${GESTION_DIR}/certbot/conf/af-vhost"
CERT_DIR="${GESTION_DIR}/certbot/conf/af-activos"
NGINX_CONF="${GESTION_DIR}/nginx.conf"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

if [[ $EUID -ne 0 ]]; then
    echo "Necesita sudo: sudo bash $0 ${1:-}"
    exit 1
fi

CHANGED="no"
NEEDS_RELOAD="no"
NEEDS_RESTART="no"

# ── 1. El contenedor del proxy debe estar corriendo ──
if ! docker ps --format '{{.Names}}' | grep -qx "${PROXY}"; then
    log "ERROR: el contenedor ${PROXY} no está corriendo. No se puede publicar ${DOMAIN}."
    exit 1
fi

# ── 2. El certificado de nuestro dominio debe estar donde el proxy lo lee ──
mkdir -p "${CERT_DIR}" "${VHOST_DIR}"
TMP_CERT="$(mktemp -d)"
trap 'rm -rf "${TMP_CERT}"' EXIT

if docker run --rm -v "${LE_VOLUME}":/le -v "${TMP_CERT}":/out alpine \
        sh -c "cp -L /le/live/${DOMAIN}/fullchain.pem /le/live/${DOMAIN}/privkey.pem /out/ 2>/dev/null"; then
    if ! cmp -s "${TMP_CERT}/fullchain.pem" "${CERT_DIR}/fullchain.pem"; then
        if [[ "${CHECK_ONLY}" == "yes" ]]; then
            log "PENDIENTE: el certificado del proxy está desactualizado (hubo renovación)."
        else
            cp "${TMP_CERT}/fullchain.pem" "${TMP_CERT}/privkey.pem" "${CERT_DIR}/"
            chmod 600 "${CERT_DIR}/privkey.pem"
            log "Certificado actualizado en el proxy (renovación detectada)."
            CHANGED="yes"; NEEDS_RELOAD="yes"
        fi
    fi
else
    log "AVISO: no se pudo leer el certificado del volumen ${LE_VOLUME} (¿ya lo emitiste?)."
fi

# ── 3. El archivo del vhost debe existir ──
SRC_VHOST="${APP_DIR}/deploy/nginx-proxy-vhost.conf"
DST_VHOST="${VHOST_DIR}/${DOMAIN}.conf"
if [[ -f "${SRC_VHOST}" ]] && ! cmp -s "${SRC_VHOST}" "${DST_VHOST}"; then
    if [[ "${CHECK_ONLY}" == "yes" ]]; then
        log "PENDIENTE: el vhost del proxy difiere del que está en el repo."
    else
        cp "${SRC_VHOST}" "${DST_VHOST}"
        log "Vhost instalado/actualizado en ${DST_VHOST}"
        CHANGED="yes"; NEEDS_RELOAD="yes"
    fi
fi

# ── 4. El `include` debe estar en el nginx.conf que ve el contenedor ──
if ! docker exec "${PROXY}" grep -q 'af-vhost' /etc/nginx/nginx.conf 2>/dev/null; then
    log "PROBLEMA: el contenedor ${PROXY} no tiene el include de af-vhost (${DOMAIN} está caído)."
    if [[ "${CHECK_ONLY}" == "yes" ]]; then
        log "PENDIENTE: hay que agregar el include y reiniciar ${PROXY}."
    else
        if ! grep -q 'af-vhost' "${NGINX_CONF}"; then
            cp "${NGINX_CONF}" "${NGINX_CONF}.bak-$(date +%Y%m%d%H%M%S)"
            # Insertar dentro del bloque http, antes del primer upstream o server
            if grep -qE '^\s*upstream\s' "${NGINX_CONF}"; then
                sed -i '0,/^\s*upstream\s/s|^\(\s*\)upstream|\1include /etc/letsencrypt/af-vhost/*.conf;\n\n\1upstream|' "${NGINX_CONF}"
            else
                sed -i '0,/^\s*server\s*{/s|^\(\s*\)server\s*{|\1include /etc/letsencrypt/af-vhost/*.conf;\n\n\1server {|' "${NGINX_CONF}"
            fi
            if grep -q 'af-vhost' "${NGINX_CONF}"; then
                log "Include agregado a ${NGINX_CONF} (respaldo .bak-* creado)."
            else
                log "ERROR: no se pudo insertar el include automáticamente. Hazlo a mano."
                exit 1
            fi
        fi
        NEEDS_RESTART="yes"; CHANGED="yes"
    fi
fi

# ── 5. Aplicar los cambios ──
if [[ "${CHECK_ONLY}" != "yes" ]]; then
    if [[ "${NEEDS_RESTART}" == "yes" ]]; then
        # Validar la configuración ANTES de reiniciar, con un contenedor desechable
        if docker run --rm \
                -v "${NGINX_CONF}":/etc/nginx/nginx.conf:ro \
                -v "${GESTION_DIR}/certbot/conf":/etc/letsencrypt:ro \
                -v "${GESTION_DIR}/certbot/www":/var/www/certbot:ro \
                nginx:alpine nginx -t >/dev/null 2>&1; then
            log "Configuración válida. Reiniciando ${PROXY} (~5s de corte)..."
            docker restart "${PROXY}" >/dev/null
            sleep 4
        else
            log "ERROR: la configuración nueva no es válida. NO se reinició nada."
            docker run --rm -v "${NGINX_CONF}":/etc/nginx/nginx.conf:ro \
                -v "${GESTION_DIR}/certbot/conf":/etc/letsencrypt:ro \
                -v "${GESTION_DIR}/certbot/www":/var/www/certbot:ro \
                nginx:alpine nginx -t 2>&1 | tail -5
            exit 1
        fi
    elif [[ "${NEEDS_RELOAD}" == "yes" ]]; then
        docker exec "${PROXY}" nginx -s reload >/dev/null 2>&1 && log "nginx recargado (sin corte)."
    fi
fi

# ── 6. Verificación final: ¿qué certificado sirve el 443 para nuestro dominio? ──
CN="$(echo | openssl s_client -connect 127.0.0.1:443 -servername "${DOMAIN}" 2>/dev/null \
      | openssl x509 -noout -subject 2>/dev/null | sed 's/.*CN *= *//')"
if [[ "${CN}" == "${DOMAIN}" ]]; then
    [[ "${CHANGED}" == "yes" ]] && log "REPARADO: ${DOMAIN} vuelve a responder con su certificado." \
                                || log "OK: ${DOMAIN} responde correctamente (sin cambios)."
    exit 0
else
    log "ATENCIÓN: el 443 sigue respondiendo con el certificado de '${CN:-desconocido}' para ${DOMAIN}."
    [[ "${CHECK_ONLY}" == "yes" ]] && exit 1
    log "Revisa manualmente: docker exec ${PROXY} nginx -T | grep -A3 'server_name ${DOMAIN}'"
    exit 1
fi
