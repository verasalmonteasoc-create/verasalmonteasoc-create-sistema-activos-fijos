# Sistema de Gestión de Activos Fijos

Sistema web empresarial para gestión integral de activos fijos con cálculo automático de depreciación, reportes analíticos y auditoría completa.

## 🎯 Características Principales

- **Gestión de Activos**: ABM completo de activos con todos los detalles
- **Depreciación Automática**: Cálculo automático mensual por línea recta
- **3 Categorías**: 
  - Edificaciones (5% anual)
  - Vehículos/Equipos (25% anual)
  - Otros Activos (15% anual)
- **Reportes Avanzados**: Por categoría, departamento, antigüedad y exportación CSV
- **Control de Acceso**: Roles de admin y usuario con auditoría completa
- **Dashboard Ejecutivo**: KPIs en tiempo real con gráficos
- **Interfaz Profesional**: Diseño responsivo inspirado en PopularEnLínea

## 📋 Requisitos Previos

- Docker 20.10+
- Docker Compose 2.0+
- Git
- Navegador moderno (Chrome, Firefox, Safari, Edge)

## 🚀 Instalación Rápida (Docker)

### 1. Clonar o descargar el proyecto

```bash
cd /ruta/del/proyecto
```

### 2. Crear archivo de configuración

```bash
cp .env.example .env
```

Editar `.env` si es necesario con valores personalizados:

```env
FLASK_ENV=development
DB_NAME=asset_management
DB_USER=postgres
DB_PASSWORD=tu_contraseña_segura
SECRET_KEY=tu_clave_secreta_aleatoria
```

### 3. Iniciar servicios Docker

```bash
docker-compose up -d
```

Esto iniciará:
- PostgreSQL (puerto 5432)
- Backend Flask (puerto 5000)
- Nginx (puerto 80)

### 4. Esperar a que la aplicación esté lista

```bash
# Ver logs
docker-compose logs -f backend

# Health check
curl http://localhost/health
```

### 5. Acceder a la aplicación

Abrir navegador: **http://localhost**

## 👤 Credenciales Iniciales

| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| admin@sistema.com | Admin123! | Administrador |
| user@sistema.com | User123! | Usuario |

**⚠️ Cambiar contraseñas en producción**

## 📁 Estructura del Proyecto

```
asset-management-system/
├── docker/
│   ├── Dockerfile              # Imagen Docker
│   ├── entrypoint.sh          # Script de inicialización
│   └── nginx.conf             # Configuración Nginx
├── backend/
│   ├── app.py                 # Aplicación Flask
│   ├── config.py              # Configuración
│   ├── models.py              # Modelos SQLAlchemy
│   ├── routes/                # Blueprints de rutas
│   │   ├── auth.py
│   │   ├── assets.py
│   │   ├── categories.py
│   │   └── reports.py
│   ├── migrations/            # SQL de inicialización
│   └── logs/                  # Logs de la aplicación
├── frontend/
│   ├── index.html             # Aplicación principal
│   ├── login.html             # Página de login
│   ├── css/
│   │   ├── style.css          # Estilos principales
│   │   └── responsive.css     # Responsive design
│   └── js/
│       ├── app.js             # Lógica principal
│       └── api.js             # Servicio API
├── docker-compose.yml         # Configuración de servicios
├── requirements.txt           # Dependencias Python
├── SPECIFICATIONS.md          # Especificaciones técnicas
└── README.md                  # Este archivo
```

## 🔧 Comandos Útiles de Docker

### Ver servicios en ejecución

```bash
docker-compose ps
```

### Ver logs de un servicio

```bash
docker-compose logs -f backend
docker-compose logs -f postgres
docker-compose logs -f nginx
```

### Detener servicios

```bash
docker-compose down
```

### Detener y eliminar volúmenes (⚠️ BORRA DATOS)

```bash
docker-compose down -v
```

### Ejecutar comando en contenedor

```bash
docker-compose exec backend python manage.py shell
```

### Recompilar imagen Docker

```bash
docker-compose build --no-cache
```

## 🗄️ Base de Datos

### Acceder a PostgreSQL

```bash
docker-compose exec postgres psql -U postgres -d asset_management
```

### Comandos SQL útiles

```sql
-- Listar tablas
\dt

-- Ver estructura de tabla
\d users

-- Salir
\q
```

### Backup de BD

```bash
docker-compose exec postgres pg_dump -U postgres asset_management > backup.sql
```

### Restaurar BD

```bash
docker-compose exec -T postgres psql -U postgres asset_management < backup.sql
```

## 📊 Uso de la Aplicación

### Dashboard
- Vista de KPIs principales
- Gráficos de activos por categoría y estado
- Últimos activos registrados

### Gestión de Activos
- Crear nuevo activo con todos los detalles
- Filtrar por categoría y estado
- Ver resumen de depreciación por activo
- Retirar activos

### Análisis de Depreciación
- Depreciación por período (año/mes)
- Cronograma de depreciación por activo
- Proyecciones futuras

### Reportes
- Por categoría
- Por departamento
- Análisis de antigüedad
- Exportación a CSV

### Gestión de Categorías (Admin)
- Crear categorías personalizadas
- Editar tasas de depreciación
- Ver activos por categoría

## 🔐 Seguridad

- Contraseñas hasheadas con bcrypt
- CSRF protection
- SQL Injection prevention (ORM)
- XSS protection
- Validación de entrada servidor-lado
- Roles de autorización
- Auditoría completa de cambios

## 📈 API REST

### Endpoints Principales

```
POST   /api/auth/login              Login
POST   /api/auth/logout             Logout
GET    /api/auth/me                 Usuario actual

GET    /api/assets                  Listar activos
POST   /api/assets                  Crear activo
GET    /api/assets/{id}             Obtener activo
PUT    /api/assets/{id}             Actualizar activo
DELETE /api/assets/{id}             Eliminar activo
GET    /api/assets/{id}/depreciation Historial depreciación

GET    /api/categories              Listar categorías
POST   /api/categories              Crear categoría
PUT    /api/categories/{id}         Actualizar categoría
DELETE /api/categories/{id}         Eliminar categoría

GET    /api/reports/assets-summary  Resumen general
GET    /api/reports/by-category     Por categoría
GET    /api/reports/by-department   Por departamento
GET    /api/reports/depreciation    Depreciación período
GET    /api/reports/aging-analysis  Antigüedad activos
GET    /api/reports/export/csv      Exportar CSV
```

## 🐛 Solución de Problemas

### Error "Connection refused"

```bash
# Esperar a que PostgreSQL esté listo
docker-compose ps
# Verificar que postgres tenga estado "healthy"
```

### Error 502 Bad Gateway

```bash
# Revisar logs del backend
docker-compose logs backend

# Reiniciar backend
docker-compose restart backend
```

### Error de permisos BD

```bash
# Verificar permisos en BD
docker-compose exec postgres psql -U postgres -c "SELECT datname FROM pg_database;"
```

### Datos no persisten

```bash
# Verificar volúmenes
docker volume ls

# Ver estado del volumen
docker volume inspect asset-management-system_postgres_data
```

## 🚀 Despliegue en Producción

### 1. Cambiar variables de entorno

```bash
FLASK_ENV=production
SECRET_KEY=generar_clave_aleatoria_fuerte
DEBUG=False
```

### 2. Habilitar HTTPS en nginx.conf

Descomentar sección HTTPS y proporcionar certificados SSL

### 3. Configurar base de datos remota

Actualizar `DB_HOST` con IP/dominio del servidor PostgreSQL

### 4. Aumentar workers gunicorn

En docker-compose.yml: `--workers 8` (según CPU disponible)

### 5. Configurar respaldos automáticos

```bash
# Script de backup diario
0 2 * * * /scripts/backup-db.sh
```

### 6. Monitoreo y logs

- Configurar ELK Stack o similar
- Monitorear CPU, memoria y BD
- Alertas para errores críticos

## 📝 Changelog

### Versión 1.0.0 (Inicial)
- Sistema completo de gestión de activos
- Depreciación automática
- Reportes básicos
- Autenticación y autorización
- Dashboard ejecutivo

## 👥 Soporte y Contribuciones

Para reportar bugs o sugerir mejoras:
1. Crear issue en el repositorio
2. Describir el problema en detalle
3. Incluir pasos para reproducir

## 📄 Licencia

Sistema desarrollado para uso empresarial.

## 🤝 Contacto

Para consultas técnicas contactar al equipo de desarrollo.

---

**Última actualización**: Julio 2026
**Versión**: 1.0.0
