# Despliegue en producción — af.aplicacionesrd.com

Notas de la arquitectura desplegada el 23-jul-2026 en el servidor Ubuntu
(`157.245.247.91`). Leer antes de tocar cualquier cosa del despliegue.

## Arquitectura

```
Internet ──443──> tesoreria-nginx (proyecto GestionCxC, dueño de 80/443)
                      │
                      ├─ cxc.aplicacionesrd.com  → app de tesorería (su stack)
                      │
                      └─ af.aplicacionesrd.com   → proxy_pass https://157.245.247.91:8443
                                                        │
                                     af_activos_nginx (ESTE stack, puertos 8080/8443)
                                                        │
                                     af_activos_backend (Flask/Gunicorn, interno)
                                                        │
                                     af_activos_postgres (interno, sin puerto al host)
```

- Este stack es 100% autocontenido (`docker-compose.prod.yml`): red, volúmenes
  y certificados propios. Vive en `/opt/af-activos-fijos`.
- El único punto compartido con el otro proyecto es el **vhost de entrada** en
  tesoreria-nginx (ver abajo), porque en un servidor con una sola IP el puerto
  443 solo puede tenerlo un proceso.

## Archivos del vhost en el proxy de tesorería (fuera de este repo)

| Archivo (host) | Qué es |
|---|---|
| `/home/edwin/GestionCxC/certbot/conf/af-vhost/af.aplicacionesrd.com.conf` | Server block que recibe `af.aplicacionesrd.com` en 443 y reenvía a este stack (8443). Dentro del contenedor: `/etc/letsencrypt/af-vhost/`. |
| `/home/edwin/GestionCxC/certbot/conf/af-activos/{fullchain,privkey}.pem` | Copia del certificado de `af.aplicacionesrd.com` que usa tesoreria-nginx para terminar TLS. Dentro del contenedor: `/etc/letsencrypt/af-activos/`. |
| `/home/edwin/GestionCxC/nginx.conf` (línea `include /etc/letsencrypt/af-vhost/*.conf;`) | Única modificación al proyecto de tesorería. Respaldo en `nginx.conf.bak-antes-af`. |

## ⚠️ Trampa conocida: el nginx.conf de tesorería es un mount de ARCHIVO read-only

`tesoreria-nginx` monta `nginx.conf` como archivo individual y de solo lectura.
Consecuencias:

1. **Editar el archivo en el host con `sed -i`/editores NO se refleja en el
   contenedor** (el rename cambia el inodo y el mount queda apuntando al viejo).
2. No se puede editar desde dentro (read-only).
3. **Cualquier cambio a ese archivo requiere `docker restart tesoreria-nginx`**
   (~5 seg de micro-interrupción para tesorería). Antes de reiniciar, validar
   la config nueva con un contenedor desechable:

```bash
sudo docker run --rm --network gestioncxc_tesoreria-network \
  -v /home/edwin/GestionCxC/nginx.conf:/etc/nginx/nginx.conf:ro \
  -v /home/edwin/GestionCxC/certbot/conf:/etc/letsencrypt:ro \
  -v /home/edwin/GestionCxC/certbot/www:/var/www/certbot:ro \
  nginx:alpine nginx -t
```

Los archivos de `af-vhost/` y `af-activos/` NO sufren esta trampa (están bajo
un mount de directorio): cambios ahí solo necesitan
`sudo docker exec tesoreria-nginx nginx -s reload`.

## Renovación del certificado (cada ~90 días, manual por DNS-01)

El cert actual vence el **21-oct-2026**. Procedimiento completo:

```bash
cd /opt/af-activos-fijos

# 1. Emitir el cert nuevo (pide crear un TXT _acme-challenge.af en Squarespace DNS)
sudo docker compose -f docker-compose.prod.yml run --rm --entrypoint certbot certbot \
  certonly --manual --preferred-challenges dns -d af.aplicacionesrd.com \
  --email TU-CORREO --agree-tos --no-eff-email

# 2. Activarlo en el nginx de ESTE stack
sudo bash scripts/issue_cert.sh --activar

# 3. Copiar el cert nuevo al proxy de tesorería
sudo docker run --rm \
  -v af-activos-fijos_af_activos_letsencrypt:/le \
  -v /home/edwin/GestionCxC/certbot/conf:/dest alpine sh -c \
  "cp -L /le/live/af.aplicacionesrd.com/fullchain.pem /le/live/af.aplicacionesrd.com/privkey.pem /dest/af-activos/ && chmod 600 /dest/af-activos/privkey.pem"

# 4. Recargar el proxy (sin reinicio)
sudo docker exec tesoreria-nginx nginx -s reload
```

Verificación: `curl -I https://af.aplicacionesrd.com` debe dar 200 sin error SSL.

## Operación diaria

```bash
# Desplegar actualizaciones de código
cd /opt/af-activos-fijos && sudo git pull && sudo bash scripts/server_install.sh

# Logs
sudo docker compose -f docker-compose.prod.yml logs -f backend

# Estado
sudo docker compose -f docker-compose.prod.yml ps
```

El `.env` de producción vive en `/opt/af-activos-fijos/.env` (no está en git;
contiene la contraseña de la BD y el SECRET_KEY — hay que respaldarlo aparte).
