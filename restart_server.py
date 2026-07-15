#!/usr/bin/env python
"""
Script para reiniciar el servidor Flask
"""
import os
import sys
import subprocess
import time
import requests

# Agregar el proyecto al path
sys.path.insert(0, r'C:\Users\Edwin\Claude\Activos  Fijos')

def check_server():
    """Verificar si el servidor está respondiendo"""
    try:
        response = requests.get('http://localhost:8090/health', timeout=2)
        return response.status_code == 200
    except:
        return False

def check_locations_endpoint():
    """Verificar si el endpoint de localidades existe"""
    try:
        response = requests.get('http://localhost:8090/api/locations', timeout=2)
        return response.status_code != 404
    except:
        return False

def start_server():
    """Iniciar el servidor Flask"""
    print("🔄 Iniciando servidor Flask...")

    # Cambiar al directorio del proyecto
    os.chdir(r'C:\Users\Edwin\Claude\Activos  Fijos')

    # Importar y crear la app
    from backend.app import app, db
    from backend.models import Location

    # Crear tablas si no existen
    with app.app_context():
        db.create_all()
        print("✓ Tablas de BD verificadas")

        # Verificar que Location existe
        try:
            locations = Location.query.all()
            print(f"✓ Tabla Location OK - {len(locations)} registros")
        except Exception as e:
            print(f"✗ Error: {e}")
            return False

    return True

if __name__ == '__main__':
    print("=" * 60)
    print("DIAGNÓSTICO Y REINICIO DEL SERVIDOR")
    print("=" * 60)

    print("\n1. Verificando servidor actual...")
    if check_server():
        print("✓ Servidor respondiendo en http://localhost:8090")
    else:
        print("✗ Servidor no responde")

    print("\n2. Verificando endpoint /api/locations...")
    if check_locations_endpoint():
        print("✓ Endpoint disponible - TODO OK")
        print("\nℹ️  Si aún ves errores, intenta hacer un hard refresh (Ctrl+Shift+R)")
        sys.exit(0)
    else:
        print("✗ Endpoint no encontrado (404)")
        print("   Esto significa que el servidor necesita reiniciarse")

    print("\n3. Intentando inicializar sistema...")
    if start_server():
        print("✓ Sistema inicializado correctamente")
        print("\n⚠️  IMPORTANTE:")
        print("   El servidor Flask DEBE ser reiniciado manualmente.")
        print("   En la terminal donde corre Flask, presiona Ctrl+C y luego ejecuta:")
        print("   python backend/app.py")
        print("\n   O contacta al administrador del servidor para reiniciarlo.")
    else:
        print("✗ Error al inicializar")
        sys.exit(1)
