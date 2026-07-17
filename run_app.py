#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ejecutar servidor Flask directamente
"""
import sys
import os
import subprocess

print("=" * 80)
print("INICIAR SERVIDOR FLASK")
print("=" * 80)
print()

# Directorio actual
project_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(project_dir)

print(f"📁 Directorio: {project_dir}")
print()

# Paso 1: Crear venv si no existe
venv_dir = os.path.join(project_dir, "venv")
if not os.path.exists(venv_dir):
    print("📦 Creando virtual environment...")
    subprocess.run([sys.executable, "-m", "venv", venv_dir], check=True)
    print("✓ Virtual environment creado")
else:
    print("✓ Virtual environment ya existe")

print()

# Determinar Python del venv
if sys.platform == "win32":
    python_exe = os.path.join(venv_dir, "Scripts", "python.exe")
else:
    python_exe = os.path.join(venv_dir, "bin", "python")

print(f"🐍 Usando Python: {python_exe}")
print()

# Paso 2: Instalar dependencias
print("📚 Instalando dependencias...")
requirements_file = os.path.join(project_dir, "requirements.txt")
if os.path.exists(requirements_file):
    subprocess.run(
        [python_exe, "-m", "pip", "install", "-q", "-r", requirements_file],
        check=True
    )
    print("✓ Dependencias instaladas")
else:
    print("⚠️  requirements.txt no encontrado")

print()

# Paso 3: Arrancar servidor
print("=" * 80)
print("🚀 INICIANDO SERVIDOR EN http://localhost:5001")
print("=" * 80)
print()
print("Presionar Ctrl+C para detener")
print()

os.environ["FLASK_APP"] = "backend.app:create_app()"
os.environ["FLASK_ENV"] = "development"
os.environ["FLASK_DEBUG"] = "1"

try:
    subprocess.run(
        [python_exe, "-m", "flask", "run", "--port", "5001"],
        check=False
    )
except KeyboardInterrupt:
    print()
    print()
    print("✓ Servidor detenido")
    sys.exit(0)
