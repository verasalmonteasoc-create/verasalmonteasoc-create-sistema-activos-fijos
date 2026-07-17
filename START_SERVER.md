# 🚀 Iniciar Servidor Flask

Este documento explica cómo iniciar el servidor para acceder a la aplicación en http://localhost:5001

## ⚙️ Requisitos Previos

### 1. Python 3.8+
```bash
# Verificar si está instalado
python --version
# o
python3 --version
```

Si NO está instalado:
- **Windows**: Descargar desde https://www.python.org (seleccionar "Add Python to PATH")
- **macOS**: `brew install python3`
- **Linux**: `sudo apt-get install python3 python3-pip`

### 2. PostgreSQL
```bash
# Verificar si está ejecutándose
psql -h localhost -U postgres -c "SELECT 1"
```

Si NO está ejecutándose:
- **Windows**: Iniciar PostgreSQL desde Servicios o usar pgAdmin
- **macOS**: `brew services start postgresql`
- **Linux**: `sudo systemctl start postgresql`

### 3. Archivo .env
Verificar que existe `C:\Users\Edwin\Claude\Activos  Fijos\.env` con:
```
DB_HOST=localhost
DB_PORT=5434
DB_NAME=asset_management
DB_USER=postgres
DB_PASSWORD=postgres123
```

---

## 🪟 Windows - Opción 1: PowerShell (Recomendado)

### Paso 1: Abrir PowerShell como Administrador
- Presionar `Win + X`
- Seleccionar "Windows PowerShell (Admin)"

### Paso 2: Ejecutar el script
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\start-server.ps1
```

**Resultado esperado:**
```
✓ Python encontrado: Python 3.11.x
✓ Virtual environment creado
✓ Dependencias instaladas

🚀 INICIANDO SERVIDOR FLASK EN http://localhost:5001

 * Serving Flask app 'backend.app'
 * Debug mode: on
 * Running on http://127.0.0.1:5001
```

---

## 🪟 Windows - Opción 2: Batch (Simple)

### Paso 1: Hacer doble click en `run_server.bat`

O desde línea de comandos:
```cmd
run_server.bat
```

---

## 🐧 Linux/macOS

### Opción 1: Bash Script
```bash
chmod +x start-server.sh
./start-server.sh
```

### Opción 2: Manual
```bash
# Crear virtual environment
python3 -m venv venv

# Activar
source venv/bin/activate  # Linux/macOS
# o en Windows:
venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Iniciar servidor
export FLASK_ENV=development
export FLASK_DEBUG=1
python -m flask run --port 5001
```

---

## ✅ Verificar que está funcionando

### 1. Ver mensaje en consola
```
 * Running on http://127.0.0.1:5001
 * Press CTRL+C to quit
```

### 2. Abrir navegador
- Ir a http://localhost:5001
- Debe mostrarse el Dashboard con KPIs

### 3. Verificar en consola
```bash
curl http://localhost:5001/api/assets
# Debe devolver JSON con lista de activos
```

---

## 🔴 Solución de Problemas

### Error: "Connection refused en puerto 5001"
**Causa:** El servidor no está ejecutándose
**Solución:** 
- Ejecutar uno de los scripts arriba
- Revisar que Python está instalado: `python --version`

### Error: "database connection error"
**Causa:** PostgreSQL no está ejecutándose o credenciales incorrectas
**Solución:**
- Verificar que PostgreSQL está corriendo
- Verificar archivo `.env` con credenciales correctas
- Probar conexión manual: `psql -h localhost -U postgres`

### Error: "ModuleNotFoundError: No module named 'flask'"
**Causa:** Dependencias no instaladas
**Solución:**
```bash
pip install -r requirements.txt
```

### Error: "Python no encontrado"
**Causa:** Python no está en el PATH
**Solución:**
- Reinstalar Python desde python.org con "Add Python to PATH" activado
- Reiniciar PowerShell/CMD después de instalar

### El servidor inicia pero dice "404 Not Found"
**Causa:** Las rutas de depreciación no se están cargando (problema anterior)
**Solución:**
- Recargar la página (Ctrl+Shift+R para limpiar caché)
- Revisar que `backend/routes/depreciation.py` no tiene errores de sintaxis
- Revisar los logs en la consola Flask para mensajes de error

---

## 🛑 Detener el Servidor

Presionar `Ctrl + C` en la consola donde está ejecutándose Flask

```
^C
(venv) PS C:\Users\Edwin\Claude\Activos  Fijos>
```

---

## 📋 Checklist de Arranque

- [ ] Python 3.8+ instalado: `python --version`
- [ ] PostgreSQL ejecutándose: `psql -h localhost -U postgres -c "SELECT 1"`
- [ ] Archivo `.env` existe y tiene credenciales correctas
- [ ] `requirements.txt` existe
- [ ] Virtual environment creado: `venv/` existe
- [ ] Dependencias instaladas: `pip list | grep -i flask`
- [ ] Script ejecutable: `start-server.ps1` o `start-server.sh`
- [ ] Puerto 5001 disponible: `netstat -ano | findstr 5001` (vacío = disponible)

---

## 🔗 URLs Útiles

- **Aplicación**: http://localhost:5001
- **API Assets**: http://localhost:5001/api/assets
- **API Cuentas**: http://localhost:5001/api/accounting/accounts
- **API Depreciación**: http://localhost:5001/api/depreciation/months

---

**Creado:** 2026-07-17  
**Última actualización:** 2026-07-17
