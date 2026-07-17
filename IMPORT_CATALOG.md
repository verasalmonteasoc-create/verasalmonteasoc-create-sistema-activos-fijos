# Importar Catálogo de Cuentas

Este documento explica cómo importar y reemplazar el catálogo de cuentas contables.

## 📋 Archivos Relacionados

- `Catalogo_Cuentas.xlsx` - Archivo del catálogo a importar
- `import_simple.py` - Script Python para importación directa
- `import_catalog.py` - Script interactivo con validación

## 🚀 Opción 1: Importación vía Web (Recomendado)

### Paso 1: Iniciar el servidor Flask
```bash
cd "C:\Users\Edwin\Claude\Activos  Fijos"
python -m flask run --port 5001
```

### Paso 2: Llamar el endpoint de importación

**Via cURL:**
```bash
curl -X POST http://localhost:5001/api/accounting/accounts/import-file
```

**Via JavaScript (en la consola del navegador):**
```javascript
fetch('/api/accounting/accounts/import-file', {
  method: 'POST'
})
.then(r => r.json())
.then(data => console.log(data))
```

**Resultado esperado:**
```json
{
  "success": true,
  "message": "Catálogo reemplazado exitosamente",
  "old_count": 55,
  "imported_count": 123,
  "links_made": 8,
  "errors": null
}
```

---

## 🛠️ Opción 2: Script Python Directo

Si el servidor Flask no está disponible, usar el script Python directo:

### Paso 1: Asegurar que PostgreSQL está ejecutándose
```bash
# Verificar conexión
psql -h localhost -U postgres -d asset_management -c "SELECT 1"
```

### Paso 2: Ejecutar el script
```bash
cd "C:\Users\Edwin\Claude\Activos  Fijos"
python import_simple.py
```

### Resultado esperado:
```
================================================================================
IMPORTAR CATÁLOGO DE CUENTAS
================================================================================

✓ Archivo cargado: Catalogo_Cuentas.xlsx
  Sheet: Sheet1
  Filas: 124

Leyendo datos...
  2: 100001001001000 - CAJA Y BANCOS (Activo)
  3: 100001002000000 - INVERSIONES CORTO PLAZO (Activo)
  4: 100002001000000 - CUENTAS POR COBRAR (Activo)
  5: 100003001002001 - EDIFICIO KM 6 1/2 (Activo)

✓ 123 cuentas leídas (0 errores)

🗑️  Eliminando catálogo anterior...
  ✓ 55 cuentas eliminadas

➕ Importando 123 cuentas nuevas...
  50 cuentas...
  100 cuentas...
  ✓ 123 cuentas importadas

🔗 Vinculando a categorías...
  ✓ 3 categorías vinculadas

================================================================================
✅ IMPORTACIÓN COMPLETADA
================================================================================

Resumen:
  Cuentas eliminadas: 55
  Cuentas importadas: 123
  Categorías vinculadas: 3
```

---

## ✅ Validación Post-Importación

### 1. Verificar en la Base de Datos
```sql
SELECT COUNT(*) FROM chart_of_accounts;
-- Debe retornar: 123
```

### 2. Verificar Vinculaciones a Categorías
```sql
SELECT 
  name,
  accumulated_depreciation_account,
  depreciation_expense_account
FROM asset_categories;
```

### 3. Verificar en la Web
- Ir a **Configuración Contable**
- Debe mostrar todas las cuentas del catálogo
- Filtrar y verificar que existen cuentas de "Gasto Depreciación" y "Deprec. Acumulada"

---

## 📊 Estructura del Archivo Excel

El archivo `Catalogo_Cuentas.xlsx` debe tener las siguientes columnas:

| Columna | Nombre | Tipo | Descripción | Ejemplo |
|---------|--------|------|-------------|---------|
| A | Código | String | Código único de la cuenta | 100001001001000 |
| B | Nombre | String | Nombre descriptivo | CAJA Y BANCOS |
| C | Tipo | String | Tipo de cuenta | Activo, Pasivo, Capital, Ingreso, Gasto |
| D | Descripción | String (Opcional) | Descripción adicional | Efectivo en caja y bancos |

---

## 🔗 Vinculación Automática de Categorías

El sistema vincula automáticamente las categorías de activos con las cuentas contables:

### Criterios de Búsqueda:

1. **Cuenta de Depreciación Acumulada**
   - Busca cuentas con texto: `%Deprec%Acumulada%`
   - Ejemplo: "Deprec. Acumulada", "DEPRECIACIÓN ACUMULADA"

2. **Cuenta de Gasto de Depreciación**
   - Busca cuentas con texto: `%Gasto%Deprec%`
   - Ejemplo: "Gasto Depreciación", "GASTOS DEPRECIACIÓN"

---

## ⚠️ Solución de Problemas

### Problema: "Conexión rechazada en puerto 5001"
**Solución:** El servidor Flask no está ejecutándose
```bash
python -m flask run --port 5001
```

### Problema: "Base de datos no encontrada"
**Solución:** Verificar que PostgreSQL está corriendo y que la BD existe
```bash
psql -h localhost -U postgres -l | grep asset_management
```

### Problema: "Archivo no encontrado"
**Solución:** Asegurar que `Catalogo_Cuentas.xlsx` está en la raíz del proyecto
```bash
ls -la Catalogo_Cuentas.xlsx
```

### Problema: "Error de validación en fila X"
**Solución:** Revisar que el tipo de cuenta es válido (Activo, Pasivo, Capital, Ingreso, Gasto)

---

## 📝 Notas Importantes

1. **Reemplazo Completo**: El proceso elimina TODAS las cuentas anteriores antes de importar las nuevas
2. **Sin Reversión**: No hay opción de deshacer. Considerar hacer backup de la BD antes
3. **Vinculación Automática**: Las categorías se vinculan automáticamente si encuentran cuentas con los nombres especificados
4. **Errores No Fatales**: Si una fila tiene error, se registra pero continúa con las siguientes

---

## 🔄 Endpoints API Disponibles

### 1. Importar desde archivo local
```
POST /api/accounting/accounts/import-file
```
Importa desde el archivo `Catalogo_Cuentas.xlsx` local, reemplazando el catálogo anterior.

**Respuesta:**
```json
{
  "success": true,
  "message": "Catálogo reemplazado exitosamente",
  "old_count": 55,
  "imported_count": 123,
  "links_made": 8,
  "errors": null
}
```

### 2. Importar desde upload
```
POST /api/accounting/accounts/import-replace
Content-Type: multipart/form-data

file: [archivo.xlsx]
```
Importa desde un archivo subido, reemplazando el catálogo anterior.

### 3. Importar sin reemplazar (agregar)
```
POST /api/accounting/accounts/import
Content-Type: multipart/form-data

file: [archivo.xlsx]
```
Importa nuevas cuentas sin eliminar las existentes (agregación).

---

**Creado:** 2026-07-17  
**Última actualización:** 2026-07-17
