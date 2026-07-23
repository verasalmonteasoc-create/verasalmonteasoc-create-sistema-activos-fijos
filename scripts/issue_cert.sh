#!/usr/bin/env bash
#
# Emite el certificado real de Let's Encrypt para este stack y lo activa en el
# nginx propio (af_activos_nginx), reemplazando el autofirmado inicial.
#
# Uso:
#   sudo bash scripts/issue_cert.sh tu-correo@dominio.com
#
# ─────────────────────────────────────────────────────────────────────────────
# IMPORTANTE sobre la validación:
#
# Let's Encrypt (HTTP-01) valida el dominio conectándose al PUERTO 80 público de
# af.aplicacionesrd.com. En este servidor ese puerto lo tiene tesoreria-nginx,
# NO el nginx de este stack (que está en 8080/8443). Por eso, para que la
# validación por webroot funcione, el ACME del dominio debe poder llegar al
# webroot de ESTE stack. Tienes dos caminos:
#
#   OPCIÓN A (webroot, este script por defecto):
#     Requiere que el tráfico de http://af.aplicacionesrd.com/.well-known/
#     acme-challenge/ llegue a este stack (puerto ${HTTP_PORT:-8080}). Si vas a
#     enrutar el dominio desde tesoreria-nginx hacia este stack, añade allí un
#     paso que reenvíe /.well-known/acme-challenge/ a http://127.0.0.1:8080.
#
#   OPCIÓN B (DNS-01, sin depender del puerto 80):
#     Validas creando un registro TXT en el DNS. No necesita puertos abiertos,
#     pero requiere el plugin DNS de tu proveedor o el modo manual. Ejemplo
#     manual (te pedirá crear un registro TXT y esperar):
#
#       docker compose -f docker-compose.prod.yml run --rm --entrypoint certbot \
#         certbot certonly --manual --preferred-challenges dns \
#         -d af.aplicacionesrd.com --email TU-CORREO --agree-tos --no-eff-email
#
#     Luego corre este script con el argumento "solo-activar" para copiar el
#     cert emitido al nginx y recargar:  sudo bash scripts/issue_cert.sh --activar
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.prod.yml"
DOMAIN="${DOMAIN:-af.aplicacionesrd.com}"
# Cargar DOMAIN desde .env si está definido ahí
if [[ -f .env ]]; then
    ENV_DOMAIN="$(grep -E '^DOMAIN=' .env | cut -d= -f2- || true)"
    [[ -n "${ENV_DOMAIN}" ]] && DOMAIN="${ENV_DOMAIN}"
fi

activar_cert() {
    echo "Copiando el certificado emitido al volumen del nginx..."
    ${COMPOSE} run --rm --entrypoint sh certbot -c "
        cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem /ssl/fullchain.pem &&
        cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem   /ssl/privkey.pem"
    echo "Recargando nginx..."
    ${COMPOSE} exec nginx nginx -s reload
    echo "✓ Certificado activado. Prueba: curl -I https://${DOMAIN}"
}

# Modo "solo activar" (tras emitir por DNS-01 o manualmente).
if [[ "${1:-}" == "--activar" ]]; then
    activar_cert
    exit 0
fi

EMAIL="${1:-}"
if [[ -z "${EMAIL}" ]]; then
    echo "Uso: sudo bash scripts/issue_cert.sh tu-correo@dominio.com"
    echo "  (o: sudo bash scripts/issue_cert.sh --activar  tras emitir por DNS-01)"
    exit 1
fi

echo "== Emitiendo certificado para ${DOMAIN} (webroot) =="
echo "   Si esto falla en la validación, revisa el bloque IMPORTANTE de este"
echo "   script (probablemente necesites reenviar el ACME o usar DNS-01)."
${COMPOSE} run --rm --entrypoint certbot certbot \
    certonly --webroot -w /var/www/certbot \
    -d "${DOMAIN}" \
    --email "${EMAIL}" --agree-tos --no-eff-email

activar_cert
