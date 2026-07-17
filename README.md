# Sistema de Gestión de Activos Fijos

Un sistema completo para la gestión de activos fijos con depreciación automática, reportes SAP-style y códigos QR para inventario.

## 🎯 Características Principales

### ✅ Gestión de Activos
- Crear, editar y eliminar activos fijos
- Importar activos desde Excel
- Código único automático para cada activo
- Seguimiento de ubicación y responsable

### ✅ Depreciación Automática
- Cálculo automático por línea recta
- Procesamiento mensual con un clic
- Múltiples categorías configurables
- Proyecciones futuras

### ✅ Asientos Contables
- Generación automática de asientos
- Vinculación con cuentas contables
- Estados de asiento (draft, posted, cancelled)

### ✅ Códigos QR
- Generar QR para cada activo
- Descargar como PNG
- Imprimir etiquetas
- Scaneable con smartphone

### ✅ Reportes Profesionales (Excel)
1. Depreciación Detallada (por activo)
2. Resumen de Depreciación (por categoría)
3. Asientos Contables
4. Movimiento de Activos
5. Reconciliación (Activos vs Contabilidad)
6. Pista de Auditoría
7. Proyecciones

### ✅ Gestión de Departamentos
- Crear departamentos
- Importar desde Excel

## 🛠️ Tecnología

**Backend:** Python 3.11, Flask, SQLAlchemy, PostgreSQL
**Frontend:** HTML5, CSS3, JavaScript, Chart.js

## 📋 Requisitos

- Python 3.8+
- PostgreSQL 10+

## 🚀 Instalación

### 1. Clonar Repositorio
```bash
git clone https://github.com/tuusuario/sistema-activos-fijos.git
cd sistema-activos-fijos
```

### 2. Crear Virtual Environment
```bash
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac
```

### 3. Instalar Dependencias
```bash
pip install -r requirements.txt
```

### 4. Configurar .env
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=asset_management
DB_USER=postgres
DB_PASSWORD=tu_contraseña
```

### 5. Ejecutar Servidor
```bash
python run_app.py
```

La aplicación estará en: **http://localhost:5001**

## 📚 Uso Rápido

**Agregar Activo:** Activos → Nuevo Activo
**Depreciación Mensual:** Depreciación → Seleccionar mes → Procesar
**Generar QR:** Activos → Click QR → Descargar/Imprimir
**Asiento Contable:** Activos → Detalles → Generar Asiento
**Reportes:** Reportes → Seleccionar tipo → Descargar Excel

## 📁 Estructura

```
backend/
├── routes/
│   ├── assets.py (Activos + QR)
│   ├── depreciation.py (Depreciación)
│   ├── reports.py (Reportes)
│   └── ...
└── models.py

frontend/
├── index.html
└── js/app.js
```

## 🔒 Seguridad

- Validación de entrada
- SQLAlchemy ORM (previene SQL Injection)
- CORS configurado
- Hashing de contraseñas

## 📧 Contacto

Edwin Vera Salmonte - verasalmonte.asoc@gmail.com

## 📄 Licencia

MIT License
