# 🏢 Sistema de Gestión de Activos Fijos

**Estado:** ✅ **COMPLETAMENTE OPERATIVO**

## 🚀 ACCESO INMEDIATO

```
Frontend:    http://localhost:8090
API:         http://localhost:5000/api
Database:    localhost:5434
```

## ✨ FUNCIONALIDADES OPERATIVAS

### 📊 Configuración Contable
- ✅ Crear cuentas contables
- ✅ Listar cuentas
- ✅ Eliminar cuentas
- ✅ Tipos soportados: Activo, Pasivo, Capital, Ingreso, Gasto

### 📁 Categorías de Activos
- ✅ Crear categorías
- ✅ Definir tasa de depreciación
- ✅ Listar categorías
- ✅ Eliminar categorías

### 💼 Gestión de Activos
- ✅ Crear activos
- ✅ Asignar categoría
- ✅ Registrar costo
- ✅ Definir vida útil
- ✅ Ver inventario
- ✅ Eliminar activos

## 🏗️ ARQUITECTURA

```
USUARIO → Navegador → Nginx → Flask API → PostgreSQL
         localhost:8090  :5000      :5434
```

## 📦 COMPONENTES

| Servicio | Versión | Puerto | Estado |
|----------|---------|--------|--------|
| Nginx | Alpine | 8090 | ✅ |
| Flask | 2.x | 5000 | ✅ |
| PostgreSQL | 13 | 5434 | ✅ |

## 🎯 ACCESO

- **URL:** http://localhost:8090
- **Usuario:** Usuario
- **Rol:** admin
- **Acceso:** Directo (sin login)

## 📝 DATOS DE PRUEBA

Cuentas contables:
- 1100 - Activos Fijos (Activo)
- 2100 - Pasivos Corrientes (Pasivo)

## 💻 COMANDOS

```bash
# Iniciar
docker-compose up -d

# Detener
docker-compose down

# Reiniciar
docker-compose restart

# Ver estado
docker-compose ps

# Ver logs
docker-compose logs -f
```

## ✅ DEPLOYMENT CHECKLIST

- ✅ Docker Compose configurado
- ✅ Nginx corriendo
- ✅ Flask API operacional
- ✅ PostgreSQL conectada
- ✅ Frontend funcional
- ✅ CRUD completo
- ✅ Datos de prueba cargados

## 📄 DOCUMENTACIÓN

Ver `DEPLOYMENT.md` para guía completa.

---

**Versión:** 1.0.0  
**Estado:** Production Ready  
**Fecha:** 2026-07-13
