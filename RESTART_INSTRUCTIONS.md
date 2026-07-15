# 🔧 Instrucciones para Reiniciar el Servidor Flask

El servidor Flask necesita ser reiniciado para que el endpoint `/api/locations` esté disponible.

## ⚙️ Opción 1: Reinicio Manual (RECOMENDADO)

### Paso 1: Abre una terminal PowerShell o CMD
- Presiona `Windows + R`
- Escribe `powershell` o `cmd`
- Presiona Enter

### Paso 2: Navega al directorio del proyecto
```powershell
cd "C:\Users\Edwin\Claude\Activos  Fijos"
```

### Paso 3: Busca e instala Python (si no lo tienes)
Abre una terminal y ejecuta:
```powershell
python --version
```

Si no está instalado, descárgalo desde: https://www.python.org/downloads/

**Durante la instalación, asegúrate de marcar: ☑ Add Python to PATH**

### Paso 4: Ejecuta el script de inicio
```powershell
python backend/app.py
```

Deberías ver algo como:
```
 * Serving Flask app 'backend.app'
 * Debug mode: on
 * Running on http://localhost:5000
```

**NOTA:** Flask corre en puerto 5000 internamente, pero nginx lo proxy-iza en puerto 8090

### Paso 5: Verifica en el navegador
Abre: http://localhost:8090

Luego ve a **Localidades** y haz clic en **Nueva Localidad**

---

## ✅ Verificación

Una vez reiniciado, deberías poder:
- ✅ **Crear localidades** - Se guardarán en la BD
- ✅ **Editar localidades** - Los cambios se guardarán
- ✅ **Eliminar localidades** - Con confirmación
- ✅ **Ver localidades en dropdown** - Al crear/editar activos
- ✅ **Filtrar activos por localidad** - En el dashboard

---

## 🆘 Si aún tienes problemas

### Opción A: Usa el archivo batch
```powershell
.\start_server.bat
```

### Opción B: Copia y pega este comando completo
```powershell
cd "C:\Users\Edwin\Claude\Activos  Fijos" ; python backend/app.py
```

### Opción C: Verifica que el puerto esté libre
```powershell
netstat -ano | findstr :8090
```

Si hay un proceso en ese puerto, tómalo nota del PID y mata el proceso:
```powershell
taskkill /PID <PID> /F
```

---

## 📋 Checklist Final

- [ ] He instalado/verificado Python
- [ ] He ejecutado `python backend/app.py`
- [ ] El servidor está corriendo (veo mensajes de Flask)
- [ ] Recargué la página del navegador
- [ ] Ahora puedo crear una localidad sin error 404

¡Una vez completados estos pasos, las localidades funcionarán perfectamente! 🎉
