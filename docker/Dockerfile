# Dockerfile para Sistema de Gestión de Activos Fijos
# Imagen oficial de Python (Debian slim) con Python moderno.
# Ubuntu 20.04 traía Python 3.8, incompatible con las dependencias pinneadas
# (blinker 1.9.0, Flask 3.1.x, etc. requieren Python >= 3.9).
FROM python:3.12-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONPATH=/app

# Dependencias del sistema:
# - postgresql-client: cliente psql (útil para debug)
# - curl: usado por el HEALTHCHECK
# - netcat-openbsd: usado por entrypoint.sh para esperar a Postgres (nc -z)
# - build-essential / libpq-dev: fallback por si algún paquete necesita compilar
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    curl \
    netcat-openbsd \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar e instalar dependencias de Python (gunicorn viene en requirements.txt)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copiar código de la aplicación
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Crear directorios necesarios
RUN mkdir -p /app/backend/logs \
    && mkdir -p /app/backend/uploads \
    && chmod 755 /app/backend/logs

# Usuario no-root para seguridad
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app

# Script de entrada
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

EXPOSE 5000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "--timeout", "120", "backend.app:app"]
