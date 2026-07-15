#!/usr/bin/env python
"""
Script para inicializar el sistema - crear tablas y verificar que todo esté correcto
"""
import sys
sys.path.insert(0, r'C:\Users\Edwin\Claude\Activos  Fijos')

from backend.app import app, db
from backend.models import Location, Department, AssetCategory

def init_system():
    with app.app_context():
        # Crear todas las tablas
        db.create_all()
        print("✓ Tablas de base de datos verificadas/creadas")

        # Verificar que Location existe
        try:
            locations = Location.query.all()
            print(f"✓ Tabla de localidades OK - {len(locations)} registros")
        except Exception as e:
            print(f"✗ Error con tabla de localidades: {e}")
            return False

        # Verificar departamentos
        try:
            departments = Department.query.all()
            print(f"✓ Tabla de departamentos OK - {len(departments)} registros")
        except Exception as e:
            print(f"✗ Error con tabla de departamentos: {e}")
            return False

        # Verificar categorías
        try:
            categories = AssetCategory.query.all()
            print(f"✓ Tabla de categorías OK - {len(categories)} registros")
        except Exception as e:
            print(f"✗ Error con tabla de categorías: {e}")
            return False

        print("\n✓ Sistema inicializado correctamente")
        return True

if __name__ == '__main__':
    success = init_system()
    sys.exit(0 if success else 1)
