#!/bin/bash
set -e

echo "Esperando a que PostgreSQL esté disponible..."
while ! nc -z $DB_HOST $DB_PORT; do
  sleep 1
done

echo "PostgreSQL disponible, continuando..."
sleep 3

echo "Inicializando datos de aplicación..."
python3 << 'PYTHONEOF'
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

        # Crear usuarios predeterminados si no existen
        from backend.models import User

        if not User.query.filter_by(email='admin@sistema.com').first():
            admin = User(username='admin', email='admin@sistema.com', first_name='Admin', last_name='Sistema', role='admin', active=True)
            admin.set_password('Admin123!')
            db.session.add(admin)
            print('✓ Usuario admin creado')

        if not User.query.filter_by(email='user@sistema.com').first():
            user = User(username='user', email='user@sistema.com', first_name='Usuario', last_name='Sistema', role='user', active=True)
            user.set_password('User123!')
            db.session.add(user)
            print('✓ Usuario estándar creado')

        db.session.commit()
    except Exception as e:
        print(f'Error en migraciones: {e}')
        raise
PYTHONEOF

echo "Iniciando aplicación Flask..."
exec "$@"
