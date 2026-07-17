# Script PowerShell para iniciar el servidor Flask

Write-Host "╔════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                     INICIAR SERVIDOR FLASK                        ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Verificar si requiere.txt existe
if (-not (Test-Path "requirements.txt")) {
    Write-Host "✗ requirements.txt no encontrado" -ForegroundColor Red
    exit 1
}

# Buscar Python
$pythonPaths = @(
    "python3",
    "python",
    "C:\Python311\python.exe",
    "C:\Python310\python.exe"
)

$pythonExe = $null
foreach ($path in $pythonPaths) {
    try {
        $result = & $path --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            $pythonExe = $path
            break
        }
    } catch {
        # Continuar
    }
}

if (-not $pythonExe) {
    Write-Host ""
    Write-Host "✗ No se encontró Python en el sistema" -ForegroundColor Red
    Write-Host ""
    Write-Host "Para solucionar esto:" -ForegroundColor Yellow
    Write-Host "  1. Descargar Python desde https://www.python.org"
    Write-Host "  2. Instalar con 'Add Python to PATH' activado"
    Write-Host "  3. Reiniciar PowerShell"
    Write-Host "  4. Ejecutar este script nuevamente"
    Write-Host ""
    Read-Host "Presionar Enter para salir"
    exit 1
}

Write-Host "✓ Python encontrado: $pythonExe" -ForegroundColor Green
Write-Host ""

# Verificar entorno virtual
$venvPath = "venv"
if (-not (Test-Path $venvPath)) {
    Write-Host "⚠️  Virtual environment no encontrado en: $venvPath" -ForegroundColor Yellow
    Write-Host "Creando virtual environment..." -ForegroundColor Yellow
    & $pythonExe -m venv venv
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Error creando virtual environment" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Virtual environment creado" -ForegroundColor Green
}

# Activar venv
$activateScript = "$venvPath\Scripts\Activate.ps1"
if (Test-Path $activateScript) {
    Write-Host "Activando virtual environment..." -ForegroundColor Cyan
    & $activateScript
} else {
    Write-Host "⚠️  No se pudo activar venv automáticamente" -ForegroundColor Yellow
}

# Instalar dependencias
Write-Host ""
Write-Host "Verificando dependencias..." -ForegroundColor Cyan
& pip install -q -r requirements.txt 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Error instalando dependencias" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Dependencias instaladas" -ForegroundColor Green

# Iniciar servidor
Write-Host ""
Write-Host "════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🚀 INICIANDO SERVIDOR FLASK EN http://localhost:5001" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Presionar Ctrl+C para detener el servidor" -ForegroundColor Yellow
Write-Host ""

$env:FLASK_ENV = "development"
$env:FLASK_DEBUG = "1"

& python -m flask run --port 5001

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "✗ Error iniciando el servidor" -ForegroundColor Red
    Write-Host ""
    Write-Host "Posibles soluciones:" -ForegroundColor Yellow
    Write-Host "  - Verificar que PostgreSQL está ejecutándose"
    Write-Host "  - Verificar archivo .env con credenciales de BD"
    Write-Host "  - Revisar errores en la consola arriba"
    Write-Host ""
}
