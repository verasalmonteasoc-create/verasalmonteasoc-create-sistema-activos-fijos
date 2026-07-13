#!/bin/bash
set -e

echo "Esperando a que PostgreSQL esté disponible..."
while ! nc -z $DB_HOST $DB_PORT; do
  sleep 1
done

echo "PostgreSQL disponible, continuando..."

# Esperar un poco más para asegurar que está listo
sleep 2

# Ejecutar migraciones de BD
echo "Ejecutando migraciones de base de datos..."
python3 -c "
import sys
sys.path.insert(0, '/app')
from backend.app import app, db
from backend.models import *

with app.app_context():
    try:
        db.create_all()
        print('✓ Tablas creadas correctamente')

        # Crear categorías predeterminadas si no existen
        from backend.models import AssetCategory

        if not AssetCategory.query.filter_by(name='Edificaciones').first():
            categories = [
                AssetCategory(name='Edificaciones', depreciation_rate=5, description='Edificaciones y componentes estructurales'),
                AssetCategory(name='Vehículos y Equipos', depreciation_rate=25, description='Automóviles, camiones, muebles de oficina, computadoras y sistemas de datos'),
                AssetCategory(name='Otros Activos', depreciation_rate=15, description='Otros activos no clasificados')
            ]
            for cat in categories:
                db.session.add(cat)
            db.session.commit()
            print('✓ Categorías predeterminadas creadas')
        else:
            print('✓ Categorías ya existen')
    except Exception as e:
        print(f'Error en migraciones: {e}')
        raise
"

echo "Iniciando aplicación Flask..."
exec "$@"
