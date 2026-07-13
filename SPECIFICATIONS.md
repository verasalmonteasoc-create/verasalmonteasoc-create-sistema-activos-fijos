# Sistema de Gestión de Activos Fijos - Especificaciones Técnicas

## 1. Descripción General

Sistema web para gestión integral de activos fijos con cálculo automático de depreciación según categoría. Permite registrar, clasificar, monitorear y depreciar activos de forma centralizada.

---

## 2. Requisitos Funcionales

### 2.1 Gestión de Activos
- **ABM Activos**: Crear, leer, actualizar, eliminar activos
- **Campos de Activo**:
  - Código único (autogenerado)
  - Descripción detallada
  - Categoría (1, 2 o 3)
  - Fecha de adquisición
  - Costo de adquisición (RD$)
  - Valor residual (% del costo)
  - Período fiscal de depreciación (años)
  - Estado (Activo, Inactivo, Retirado)
  - Ubicación/Departamento
  - Responsable
  - Número de serie/Placa
  - Observaciones
  - Foto/Documento (opcional)

### 2.2 Categorías de Depreciación

| Categoría | Descripción | Tasa Anual | Ejemplos |
|-----------|------------|----------|----------|
| 1 | Edificaciones y componentes | 5% | Edificios, estructuras |
| 2 | Vehículos, muebles, equipos | 25% | Autos, muebles, computadoras |
| 3 | Otros activos | 15% | Herramientas, equipos diversos |

### 2.3 Depreciación Automática
- Cálculo mensual automático (método línea recta)
- Depreciación = (Costo - Valor Residual) / Meses de vida útil
- Histórico de depreciación mensual/anual
- Reporte de depreciación por período
- Bloqueo de depreciación después de valor residual

### 2.4 Reportes y Análisis
- Listado de activos por categoría
- Estado de depreciación por período
- Valor neto en libros (VNL)
- Análisis de antigüedad de activos
- Reporte de activos por departamento
- Exportación a Excel

### 2.5 Gestión de Usuarios
- Login/logout
- Rol de administrador (acceso total)
- Rol de consulta (solo lectura)
- Auditoría de cambios (quién, cuándo, qué)

---

## 3. Requisitos No-Funcionales

### 3.1 Tecnología
- **Backend**: Python 3.10+, Flask
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla/jQuery)
- **BD**: PostgreSQL 13+
- **Servidor Web**: Nginx
- **Contenedorización**: Docker & Docker Compose
- **SO**: Ubuntu 20.04 LTS

### 3.2 Rendimiento
- Carga de dashboard < 2 segundos
- Búsqueda de activos < 500ms
- Cálculo de depreciación noche (batch)

### 3.3 Seguridad
- HTTPS en producción
- CSRF protection
- SQL Injection prevention (ORM)
- XSS protection
- Validación de entrada servidor-lado
- Contraseñas hasheadas (bcrypt)

### 3.4 Disponibilidad
- Backup automático BD cada 24h
- Logs centralizados
- Health checks

---

## 4. Arquitectura de Base de Datos

### Tabla: users
```
id (PK) | username | email | password_hash | role | created_at | updated_at | active
```

### Tabla: asset_categories
```
id (PK) | name | depreciation_rate (%) | description
```

### Tabla: assets
```
id (PK) | code | description | category_id (FK) | acquisition_date | acquisition_cost | residual_value (%) | useful_life_years | location | responsible | serial_number | status | created_at | updated_at | created_by (FK)
```

### Tabla: depreciation_records
```
id (PK) | asset_id (FK) | month_year | depreciation_amount | accumulated_depreciation | net_book_value | calculated_at | calculated_by (FK)
```

### Tabla: audit_log
```
id (PK) | user_id (FK) | entity_type | entity_id | action | old_value | new_value | timestamp
```

---

## 5. API RESTful Endpoints

### Autenticación
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Usuario actual

### Activos
- `GET /api/assets` - Listar activos (con filtros)
- `GET /api/assets/{id}` - Obtener activo
- `POST /api/assets` - Crear activo
- `PUT /api/assets/{id}` - Actualizar activo
- `DELETE /api/assets/{id}` - Eliminar activo
- `GET /api/assets/{id}/depreciation` - Historial depreciación

### Categorías
- `GET /api/categories` - Listar categorías
- `POST /api/categories` - Crear categoría
- `PUT /api/categories/{id}` - Actualizar categoría

### Reportes
- `GET /api/reports/depreciation?from=&to=` - Reporte depreciación
- `GET /api/reports/by-category` - Activos por categoría
- `GET /api/reports/by-department` - Activos por departamento
- `GET /api/reports/export?format=excel` - Exportar

---

## 6. Estructura de Carpetas

```
asset-management-system/
├── docker/
│   ├── Dockerfile
│   ├── entrypoint.sh
│   └── nginx.conf
├── backend/
│   ├── app.py
│   ├── config.py
│   ├── models.py
│   ├── routes/
│   │   ├── auth.py
│   │   ├── assets.py
│   │   ├── categories.py
│   │   └── reports.py
│   ├── utils/
│   │   ├── depreciation.py
│   │   └── validators.py
│   ├── migrations/
│   │   └── init.sql
│   └── logs/
├── frontend/
│   ├── index.html
│   ├── css/
│   │   ├── style.css
│   │   └── responsive.css
│   ├── js/
│   │   ├── app.js
│   │   ├── api.js
│   │   └── sidebar.js
│   └── img/
│       └── logo.png
├── docker-compose.yml
├── requirements.txt
├── README.md
└── .env.example
```

---

## 7. Mejores Prácticas Implementadas

### 7.1 Desarrollo
- Patrón MVC para backend
- Separación de rutas por módulo
- Validación en servidor y cliente
- Manejo centralizado de errores

### 7.2 Base de Datos
- Índices en campos frecuentes (code, status)
- Constraints de integridad referencial
- Timestamps de auditoría
- Backup automático

### 7.3 Frontend
- Interfaz responsive (mobile-first)
- Validación de formularios cliente-lado
- Feedback visual (spinner, toast messages)
- Accesibilidad (WCAG 2.1 AA)

### 7.4 Operaciones
- Logs estructurados
- Monitoreo de health
- Manejo de errores y excepciones
- Configuración por variables de entorno

---

## 8. Fórmulas de Depreciación

### Depreciación Mensual (Línea Recta)
```
Depreciación Mensual = (Costo - Valor Residual) / (Años × 12)
Valor Residual = Costo × (% Residual / 100)
```

### Valor Neto en Libros
```
VNL = Costo - Depreciación Acumulada
```

### Ejemplo (Categoría 2, 25% anual):
- Costo: RD$ 100,000
- Valor Residual: 10% = RD$ 10,000
- Vida Útil: 4 años = 48 meses
- Depreciación Mensual: (100,000 - 10,000) / 48 = RD$ 1,875

---

## 9. Configuración Docker

### Servicios
1. **PostgreSQL**: BD principal (puerto 5432)
2. **Flask Backend**: API (puerto 5000)
3. **Nginx**: Servidor web (puerto 80/443)

### Volúmenes Persistentes
- `postgres_data`: BD
- `app_logs`: Logs de aplicación
- `backups`: Backups de BD

### Variables de Entorno
- `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `FLASK_ENV` (development/production)
- `SECRET_KEY` (para sesiones)

---

## 10. Plan de Ejecución

### Fase 1: Infraestructura
- [x] Especificaciones
- [ ] Docker & docker-compose
- [ ] BD (PostgreSQL)

### Fase 2: Backend
- [ ] Modelos SQLAlchemy
- [ ] API endpoints
- [ ] Autenticación
- [ ] Lógica de depreciación

### Fase 3: Frontend
- [ ] Interfaz principal
- [ ] Formularios CRUD
- [ ] Reportes
- [ ] Integración API

### Fase 4: Testing & Deployment
- [ ] Tests unitarios
- [ ] Documentación
- [ ] Deploy en Ubuntu

---

## 11. Instalación y Ejecución

```bash
# Clonar repositorio
git clone <repo>
cd asset-management-system

# Configurar variables de entorno
cp .env.example .env

# Iniciar servicios Docker
docker-compose up -d

# Ejecutar migraciones
docker-compose exec backend python manage.py migrate

# Acceder a la aplicación
# http://localhost
```

---

## 12. Usuarios de Prueba Iniciales

```
Admin:
  Usuario: admin@sistema.com
  Contraseña: Admin123!

Consulta:
  Usuario: user@sistema.com
  Contraseña: User123!
```
