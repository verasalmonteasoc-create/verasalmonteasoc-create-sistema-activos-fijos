@echo off
REM Script para iniciar el servidor Flask
cd /d "%~dp0"

echo Intentando iniciar servidor Flask en puerto 5001...
echo.

REM Intenta diferentes formas de ejecutar Python
if exist "venv\Scripts\python.exe" (
    echo Usando Python del virtual environment...
    venv\Scripts\python.exe -m flask run --port 5001
) else if exist ".venv\Scripts\python.exe" (
    echo Usando Python del virtual environment (.venv)...
    .venv\Scripts\python.exe -m flask run --port 5001
) else (
    echo Intentando con python del PATH...
    python -m flask run --port 5001
)

if errorlevel 1 (
    echo.
    echo ✗ Error al iniciar el servidor
    echo.
    echo Posibles soluciones:
    echo 1. Instalar Python desde python.org
    echo 2. Crear un virtual environment: python -m venv venv
    echo 3. Instalar dependencias: pip install -r requirements.txt
    pause
)
