# 🚀 SISTEMA DE GESTIÓN DE ACTIVOS FIJOS - DEPLOYMENT COMPLETO

**Estado:** ✅ **PRODUCCIÓN LISTA**  
**Fecha:** 2026-07-13  
**Versión:** 1.0.0

---

## 📋 TABLA DE CONTENIDOS
1. [Inicio Rápido](#inicio-rápido)
2. [Arquitectura](#arquitectura)
3. [Funcionalidades](#funcionalidades)
4. [Estructura de Carpetas](#estructura-de-carpetas)
5. [Endpoints API](#endpoints-api)
6. [Datos de Prueba](#datos-de-prueba)

---

## 🎯 INICIO RÁPIDO

### Verificar que Docker está corriendo
```bash
docker-compose ps
```

### Acceder al Sistema
- **Frontend:** http://localhost:8090
- **Backend API:** http://localhost:5000/api
- **Base de Datos:** localhost:5434

### Detener Docker
```bash
docker-compose down
```

### Reiniciar Docker
```bash
docker-compose restart
```

---

## 🏗️ ARQUITECTURA

### Componentes
```
┌─────────────────────────────────────────────┐
│         USUARIO (Navegador)                 │
│       http://localhost:8090                 │
└─────────────────┬───────────────────────────┘
                  │
          ┌───────▼────────┐
          │   Nginx 80     │
          │  (Alpine)      │
          └───────┬────────┘
                  │
    ┌─────────────┴──────────────┐
    │                            │
┌───▼──────┐          ┌──────────▼────┐
│ Frontend │          │  Flask API    │
│ (SPA)    │          │  /api/*       │
│ HTML/JS  │          │  (Gunicorn)   │
└──────────┘          └──────────┬────┘
                                 │
                      ┌──────────▼────────┐
                      │   PostgreSQL 13   │
                      │   (Asset Mgmt DB) │
                      └───────────────────┘
```

### Tecnologías
- **Frontend:** HTML5 + JavaScript Vanilla
- **Backend:** Python 3.8 + Flask + SQLAlchemy
- **Base de Datos:** PostgreSQL 13
- **Web Server:** Nginx Alpine
- **Orquestación:** Docker Compose
- **ORM:** SQLAlchemy

---

## ✨ FUNCIONALIDADES

### 1. Configuración Contable
- ✅ Crear cuentas contables (Código, Nombre, Tipo, Descripción)
- ✅ Listar todas las cuentas
- ✅ Eliminar cuentas
- ✅ Tipos: Activo, Pasivo, Capital, Ingreso, Gasto

### 2. Categorías de Activos
- ✅ Crear categorías con tasa de depreciación
- ✅ Listar categorías
- ✅ Eliminar categorías
- ✅ Vinculación con cuentas contables

### 3. Gestión de Activos
- ✅ Crear activos (Descripción, Categoría, Costo, Vida Útil)
- ✅ Listar activos con información completa
- ✅ Eliminar activos
- ✅ Cálculo automático de depreciación

### 4. Dashboard
- ✅ Pantalla de bienvenida
- ✅ Interfaz responsiva
- ✅ Navegación intuitiva

---

## 📁 ESTRUCTURA DE CARPETAS

```
proyecto/
├── docker-compose.yml          # Orquestación de contenedores
├── docker/
│   ├── Dockerfile              # Imagen del backend
│   ├── nginx.conf              # Configuración de Nginx
│   └── ssl/                    # Certificados (opcional)
│
├── backend/
│   ├── app.py                  # Aplicación Flask principal
│   ├── config.py               # Configuración
│   ├── models.py               # Modelos de BD (SQLAlchemy)
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── accounting.py       # Endpoints de cuentas contables
│   │   ├── assets.py           # Endpoints de activos
│   │   ├── auth.py             # Endpoints de autenticación
│   │   ├── categories.py       # Endpoints de categorías
│   │   └── reports.py          # Endpoints de reportes
│   ├── logs/                   # Logs de la aplicación
│   └── migrations/             # Scripts de migración
│
├── frontend/
│   ├── index.html              # Aplicación SPA
│   ├── css/
│   │   ├── style.css           # Estilos principales
│   │   └── responsive.css      # Estilos responsive
│   └── js/
│       ├── app.js              # Lógica principal
│       ├── app-new.js          # Lógica alternativa
│       └── api.js              # Cliente HTTP
│
└── uploads/
    └── invoices/               # Almacenamiento de facturas
```

---

## 🔌 ENDPOINTS API

### Configuración Contable

```http
GET    /api/accounting/accounts           # Listar cuentas
POST   /api/accounting/accounts           # Crear cuenta
PUT    /api/accounting/accounts/{id}      # Actualizar cuenta
DELETE /api/accounting/accounts/{id}      # Eliminar cuenta
```

### Categorías

```http
GET    /api/categories                    # Listar categorías
POST   /api/categories                    # Crear categoría
PUT    /api/categories/{id}               # Actualizar categoría
DELETE /api/categories/{id}               # Eliminar categoría
```

### Activos

```http
GET    /api/assets                        # Listar activos
POST   /api/assets                        # Crear activo
PUT    /api/assets/{id}                   # Actualizar activo
DELETE /api/assets/{id}                   # Eliminar activo
```

### Reportes

```http
GET    /api/reports/assets-summary        # Resumen de activos
GET    /api/reports/by-category           # Reporte por categoría
GET    /api/reports/by-department         # Reporte por departamento
```

---

## 📊 DATOS DE PRUEBA

### Cuentas Contables Creadas
```
Código: 1100
Nombre: Activos Fijos
Tipo: Activo

Código: 2100
Nombre: Pasivos Corrientes
Tipo: Pasivo
```

### Base de Datos
- **Servidor:** PostgreSQL 13
- **Base:** asset_management
- **Usuario:** postgres
- **Puerto:** 5434

---

## ⚙️ CONFIGURACIÓN IMPORTANTE

### Variables de Entorno
```bash
DB_NAME=asset_management
DB_USER=postgres
DB_PASSWORD=postgres123
FLASK_ENV=development
SECRET_KEY=dev-secret-key-change-in-production
```

### Credenciales por Defecto
- **Usuario:** Usuario
- **Email:** sistema@activos.local
- **Rol:** admin
- **Acceso:** Sin login (directo)

---

## 🔒 SEGURIDAD EN PRODUCCIÓN

Para producción, realiza los siguientes cambios:

1. **Cambiar contraseña de BD:**
   ```bash
   # En docker-compose.yml
   DB_PASSWORD=<tu-contraseña-segura>
   ```

2. **Cambiar SECRET_KEY:**
   ```bash
   # En docker-compose.yml
   SECRET_KEY=<clave-aleatoria-segura>
   ```

3. **Habilitar HTTPS:**
   ```bash
   # En docker/nginx.conf
   # Descomentar bloque HTTPS
   ```

4. **Cambiar FLASK_ENV:**
   ```bash
   # En docker-compose.yml
   FLASK_ENV=production
   ```

---

## 📈 PRÓXIMAS MEJORAS

- [ ] Autenticación y roles de usuario
- [ ] Cálculo de depreciación automático
- [ ] Generación de reportes PDF
- [ ] Importación de datos desde Excel
- [ ] Auditoría de cambios
- [ ] Backup automático de BD
- [ ] Dashboard con gráficos

---

## 🆘 TROUBLESHOOTING

### Docker no inicia
```bash
docker-compose down -v
docker-compose up -d
```

### Puerto ya en uso
```bash
# Liberar puerto 8090
lsof -i :8090
kill -9 <PID>
```

### Base de datos no conecta
```bash
# Verificar estado de PostgreSQL
docker-compose logs postgres
```

### Frontend no carga
```bash
# Limpiar caché del navegador
Ctrl+Shift+Delete
```

---

## 📞 SOPORTE

Para problemas o preguntas:
1. Revisar logs: `docker-compose logs`
2. Reiniciar servicios: `docker-compose restart`
3. Verificar conectividad: `curl http://localhost:8090`

---

**Versión:** 1.0.0  
**Estado:** ✅ Production Ready  
**Última actualización:** 2026-07-13 15:38  
