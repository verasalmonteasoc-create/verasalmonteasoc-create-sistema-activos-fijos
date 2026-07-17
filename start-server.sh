#!/bin/bash
# Script para iniciar el servidor Flask

echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║                     INICIAR SERVIDOR FLASK                        ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

cd "$(dirname "$0")"

# Verificar Python
if ! command -v python3 &> /dev/null; then
    if ! command -v python &> /dev/null; then
        echo "✗ Python no encontrado"
        echo ""
        echo "Instalar Python:"
        echo "  Ubuntu/Debian: sudo apt-get install python3 python3-pip"
        echo "  macOS: brew install python3"
        echo "  Windows: Descargar desde https://www.python.org"
        exit 1
    fi
    PYTHON="python"
else
    PYTHON="python3"
fi

echo "✓ Python encontrado: $($PYTHON --version)"
echo ""

# Crear venv si no existe
if [ ! -d "venv" ]; then
    echo "Creando virtual environment..."
    $PYTHON -m venv venv
    echo "✓ Virtual environment creado"
fi

# Activar venv
source venv/bin/activate 2>/dev/null || . venv/Scripts/activate 2>/dev/null

# Instalar dependencias
echo "Verificando dependencias..."
pip install -q -r requirements.txt

# Configurar variables de entorno
export FLASK_ENV=development
export FLASK_DEBUG=1

# Iniciar servidor
echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "🚀 INICIANDO SERVIDOR FLASK EN http://localhost:5001"
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo "Presionar Ctrl+C para detener el servidor"
echo ""

python -m flask run --port 5001
