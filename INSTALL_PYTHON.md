# 🐍 Instalar Python 3

El servidor no puede ejecutarse porque **Python no está instalado** o no está en el PATH.

---

## ✅ Solución: Instalar Python

### Paso 1: Descargar Python

1. Ir a https://www.python.org/downloads/
2. Descargar **Python 3.11** (última versión estable)
3. Seleccionar versión para Windows

![Python Download](https://www.python.org/static/community_logos/python-logo.png)

**Enlace directo:** https://www.python.org/ftp/python/3.11.8/python-3.11.8-amd64.exe

---

### Paso 2: Ejecutar Instalador

1. Hacer doble click en `python-3.11.8-amd64.exe`
2. **IMPORTANTE:** En la primera pantalla, marcar:
   - ✓ "Add Python 3.11 to PATH" (OBLIGATORIO)
   - ✓ "Install for all users" (Recomendado)
3. Click en "Install Now"
4. Esperar a que termine

**Screenshot - MARCAR ESTA OPCIÓN:**
```
□ Install launcher for all users (recommended)
☑ Add Python 3.11 to PATH  ← ESTA ES LA IMPORTANTE
```

---

### Paso 3: Verificar Instalación

Abrir **PowerShell** o **CMD** y ejecutar:

```powershell
python --version
```

Debe mostrar:
```
Python 3.11.8
```

Si muestra lo anterior ✓, la instalación fue exitosa.

---

## 🚀 Después de Instalar Python

Una vez que Python esté instalado:

### Opción 1: Ejecutar Script PowerShell (Recomendado)
```powershell
cd "C:\Users\Edwin\Claude\Activos  Fijos"
.\start-server.ps1
```

### Opción 2: Doble Click en Batch
```
C:\Users\Edwin\Claude\Activos  Fijos\run_server.bat
```

---

## 🆘 Si Aún No Funciona Después de Instalar

### Verificación de Diagnóstico

```powershell
# 1. Verificar Python
python --version

# 2. Verificar pip
pip --version

# 3. Verificar que Flask se puede importar
python -c "import flask; print(f'Flask {flask.__version__}')"

# 4. Verificar PostgreSQL
psql -h localhost -U postgres -c "SELECT 1"

# 5. Verificar puerto 5001 disponible
netstat -ano | findstr "5001"
```

### Soluciones por Error

**"python: command not found"**
- Python no está en el PATH
- Solución: Reinstalar Python con "Add Python to PATH" marcado
- Reiniciar PowerShell/CMD después

**"No module named 'flask'"**
- Flask no está instalado
- Solución: 
  ```powershell
  pip install -r requirements.txt
  ```

**"Error de conexión a PostgreSQL"**
- PostgreSQL no está ejecutándose
- Solución: Iniciar PostgreSQL desde Servicios de Windows

**"Port 5001 already in use"**
- Otro proceso está usando ese puerto
- Solución:
  ```powershell
  netstat -ano | findstr "5001"
  # Ver qué PID usa el puerto
  taskkill /PID [PID] /F
  ```

---

## 📝 Desinstalación Completa (Si Necesitas Empezar de Nuevo)

### Windows

1. **Desinstalar Python**
   - Ir a: Configuración → Aplicaciones → Aplicaciones instaladas
   - Buscar "Python 3.11"
   - Click en Desinstalar

2. **Limpiar Path (Opcional)**
   - Ir a: Configuración → Sistema → Variables de entorno
   - Buscar Python en "PATH"
   - Eliminar cualquier referencia

3. **Reinstalar**
   - Descargar nuevamente desde python.org
   - Instalar con "Add Python to PATH" marcado

---

## ✅ Checklist Final

- [ ] Python descargado desde python.org
- [ ] Instalador ejecutado
- [ ] "Add Python to PATH" estaba marcado
- [ ] PowerShell/CMD reiniciada
- [ ] `python --version` muestra versión
- [ ] `pip --version` muestra versión
- [ ] `pip install -r requirements.txt` ejecutado exitosamente
- [ ] PostgreSQL está ejecutándose
- [ ] `start-server.ps1` o `run_server.bat` ejecutado

---

## 🔗 Enlaces Útiles

- **Python Official**: https://www.python.org
- **Python 3.11 Downloads**: https://www.python.org/downloads/release/python-3118/
- **Flask Documentation**: https://flask.palletsprojects.com/
- **PostgreSQL**: https://www.postgresql.org/

---

**Creado:** 2026-07-17  
**Última actualización:** 2026-07-17

---

## 📞 Soporte Rápido

Si después de esto aún no funciona:

1. Abrir PowerShell
2. Ejecutar:
   ```powershell
   python -c "import sys; print(sys.executable)"
   pip list
   ```
3. Compartir la salida para diagnosticar el problema específico

