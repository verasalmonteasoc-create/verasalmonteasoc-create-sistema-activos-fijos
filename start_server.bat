@echo off
REM Script para iniciar el servidor Flask

setlocal enabledelayedexpansion

echo ==========================================
echo Iniciando Servidor Flask
echo ==========================================

REM Cambiar al directorio del proyecto
cd /d "C:\Users\Edwin\Claude\Activos  Fijos"

REM Buscar Python en ubicaciones comunes
set PYTHON_EXE=
for %%P in (
    "C:\Python312\python.exe"
    "C:\Python311\python.exe"
    "C:\Python310\python.exe"
    "%USERPROFILE%\AppData\Local\Programs\Python\Python312\python.exe"
    "%USERPROFILE%\AppData\Local\Programs\Python\Python311\python.exe"
    "%USERPROFILE%\AppData\Local\Programs\Python\Python310\python.exe"
) do (
    if exist %%P (
        set "PYTHON_EXE=%%P"
        echo ✓ Encontrado Python: %%P
        goto :found
    )
)

:found
if "!PYTHON_EXE!"=="" (
    echo ✗ Python no encontrado
    echo.
    echo Por favor instala Python desde https://www.python.org
    pause
    exit /b 1
)

echo.
echo Iniciando servidor en puerto 8090...
echo.

"!PYTHON_EXE!" backend/app.py

pause
