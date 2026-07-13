# Guía de Instalación - Sistema de Gestión de Activos Fijos

Instrucciones detalladas para configurar e instalar el sistema.

---

## 📦 Paso 1: Preparar Estructura de Carpetas

Crear la siguiente estructura en tu máquina:

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
│   │   ├── __init__.py
│   │   ├── auth.py → auth_routes.py
│   │   ├── assets.py → assets_routes.py
│   │   ├── categories.py → categories_routes.py
│   │   └── reports.py → reports_routes.py
│   ├── migrations/
│   │   └── init.sql
│   └── logs/
│       └── .gitkeep
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── css/
│   │   ├── style.css
│   │   └── responsive.css
│   └── js/
│       ├── app.js
│       └── api.js
├── docker-compose.yml
├── requirements.txt
├── .env.example
├── .env (crear a partir de .env.example)
├── .gitignore
├── README.md
├── SPECIFICATIONS.md
└── INSTALL_GUIDE.md
```

---

## 🗂️ Paso 2: Copiar Archivos

### Archivos a copiar directamente:

1. **docker/Dockerfile** ← Dockerfile
2. **docker/entrypoint.sh** ← entrypoint.sh
3. **docker/nginx.conf** ← nginx.conf
4. **backend/app.py** ← app.py
5. **backend/config.py** ← config.py
6. **backend/models.py** ← models.py
7. **requirements.txt** ← requirements.txt
8. **docker-compose.yml** ← docker-compose.yml
9. **frontend/index.html** ← index.html
10. **frontend/css/style.css** ← style.css
11. **frontend/css/responsive.css** ← responsive.css
12. **frontend/js/api.js** ← api.js
13. **frontend/js/app.js** ← app.js
14. **README.md** ← README.md
15. **.env.example** ← .env.example
16. **SPECIFICATIONS.md** ← SPECIFICATIONS.md

### Archivos de rutas (crear carpeta backend/routes/):

Crear archivo `backend/routes/__init__.py`:
```python
"""Routes package"""
from .auth import auth_bp
from .assets import assets_bp
from .categories import categories_bp
from .reports import reports_bp

__all__ = ['auth_bp', 'assets_bp', 'categories_bp', 'reports_bp']
```

Copiar:
- **backend/routes/auth.py** ← auth_routes.py
- **backend/routes/assets.py** ← assets_routes.py
- **backend/routes/categories.py** ← categories_routes.py
- **backend/routes/reports.py** ← reports_routes.py

---

## 🔧 Paso 3: Crear Archivos Adicionales

### backend/migrations/init.sql

```sql
-- Este archivo se ejecuta al inicializar PostgreSQL
-- Las tablas serán creadas automáticamente por SQLAlchemy

CREATE SCHEMA IF NOT EXISTS public;
```

### frontend/login.html

```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Sistema de Activos</title>
    <link rel="stylesheet" href="css/style.css">
    <style>
        .login-container {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            background: linear-gradient(135deg, #003d7a 0%, #002349 100%);
        }
        .login-box {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            width: 100%;
            max-width: 400px;
        }
        .login-box h1 {
            text-align: center;
            color: #003d7a;
            margin-bottom: 30px;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="login-box">
            <h1>Sistema de Activos</h1>
            <form id="loginForm">
                <div class="form-group">
                    <label class="form-label">Usuario</label>
                    <input type="text" id="username" class="form-control" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Contraseña</label>
                    <input type="password" id="password" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="remember"> Recuérdame
                    </label>
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%;">Iniciar Sesión</button>
            </form>
            <p id="error" style="color: #ef4444; margin-top: 15px; text-align: center;"></p>
        </div>
    </div>

    <script src="js/api.js"></script>
    <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const remember = document.getElementById('remember').checked;

            try {
                const response = await API.auth.login(username, password, remember);
                if (response.success) {
                    window.location.href = '/index.html';
                }
            } catch (error) {
                document.getElementById('error').textContent = 'Usuario o contraseña incorrectos';
            }
        });
    </script>
</body>
</html>
```

### .gitignore

```
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg

# Virtual environments
venv/
env/
ENV/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# Environment
.env
.env.local
.env.*.local

# Logs
logs/
*.log

# Database
*.db
*.sqlite
*.sqlite3

# Docker
.dockerignore

# OS
.DS_Store
Thumbs.db

# Node modules (si usas frontend tools)
node_modules/
npm-debug.log

# Uploads
backend/uploads/*
!backend/uploads/.gitkeep
```

---

## 🐳 Paso 4: Configurar Variables de Entorno

### Crear archivo .env

```bash
cp .env.example .env
```

Editar `.env` con valores apropiados (mínimas modificaciones para desarrollo):

```env
FLASK_ENV=development
DEBUG=True
DB_HOST=postgres
DB_PORT=5432
DB_NAME=asset_management
DB_USER=postgres
DB_PASSWORD=postgres123
SECRET_KEY=dev-secret-key-change-in-production
```

---

## 🚀 Paso 5: Iniciar con Docker

### Verificar Docker y Docker Compose

```bash
docker --version
docker-compose --version
```

Ambos deben estar instalados.

### Construir y lanzar servicios

```bash
# Construir imágenes
docker-compose build

# Iniciar servicios (en segundo plano)
docker-compose up -d

# Ver estado
docker-compose ps
```

El output debe mostrar 3 servicios "Up":
- postgres
- backend
- nginx

### Verificar disponibilidad

```bash
# Health check
sleep 10
curl http://localhost/health

# Debería retornar:
# {"status": "healthy", "timestamp": "...", "database": "connected"}
```

---

## ✅ Paso 6: Verificar Instalación

### Acceder a la aplicación

```
Abrir navegador: http://localhost
```

### Primeros pasos

1. Si muestra login.html directamente, esperar 5 segundos
2. Si redirige a index.html, significa que ya hay sesión activa
3. Limpiar cookies/localStorage si es necesario

### Usuarios de prueba

```
Admin:
  Email: admin@sistema.com
  Contraseña: Admin123!

Usuario:
  Email: user@sistema.com
  Contraseña: User123!
```

### Verificar funciones básicas

1. **Login**: Inicia sesión con admin@sistema.com
2. **Dashboard**: Debe mostrar KPIs y gráficos
3. **Crear Activo**: Ir a "Nuevo Activo" y crear un activo de prueba
4. **Listar Activos**: Verificar que aparezca en la lista
5. **Reportes**: Hacer clic en "Reportes" y generar reportes

---

## 🔍 Paso 7: Troubleshooting

### Error: "Connection refused" en PostgreSQL

```bash
# Esperar a que PostgreSQL esté listo
docker-compose logs postgres

# Debe haber línea: "database system is ready to accept connections"

# Si no, reiniciar:
docker-compose restart postgres
sleep 10
docker-compose up -d
```

### Error: 502 Bad Gateway

```bash
# Ver logs del backend
docker-compose logs backend

# Reiniciar backend
docker-compose restart backend

# Esperar 10 segundos y recargar página
```

### Error: No se ve la interfaz

```bash
# Verificar que nginx esté activo
docker-compose logs nginx

# Verificar puerto 80
netstat -tuln | grep 80

# Si otro servicio ocupa puerto 80, cambiar en docker-compose.yml:
# Cambiar "80:80" a "8080:80" y acceder a http://localhost:8080
```

### Error: 404 en API

```bash
# Verificar rutas en app.py
docker-compose exec backend python -c "from backend.app import app; print(app.url_map)"

# Debe listar todos los endpoints /api/...
```

---

## 📊 Paso 8: Crear Datos de Prueba

### Crear activo desde API (opcional)

```bash
curl -X POST http://localhost/api/assets \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Computadora HP EliteBook",
    "category_id": 2,
    "acquisition_date": "2024-01-15",
    "acquisition_cost": 50000,
    "residual_value_percent": 10,
    "useful_life_years": 4,
    "location": "Oficina Principal",
    "department": "IT",
    "responsible": "Juan Pérez"
  }'
```

---

## 🛑 Paso 9: Parar Servicios

### Detener sin eliminar datos

```bash
docker-compose stop
```

### Reiniciar

```bash
docker-compose start
```

### Detener y eliminar contenedores (datos persisten en volúmenes)

```bash
docker-compose down
```

### CUIDADO: Eliminar todo incluyendo BD

```bash
docker-compose down -v
```

---

## 📝 Paso 10: Configuración para Producción

### Cambiar variables de entorno

```env
FLASK_ENV=production
DEBUG=False
SECRET_KEY=generar_clave_aleatoria_segura_de_32_caracteres
DB_PASSWORD=contraseña_muy_segura
```

### Aumentar workers gunicorn

En `docker-compose.yml`, cambiar comando del backend:
```yaml
command: gunicorn --bind 0.0.0.0:5000 --workers 8 --timeout 120 backend.app:app
```

### Habilitar HTTPS

En `docker/nginx.conf`, descomentar sección HTTPS y proporcionar certificados SSL

### Configurar backup automático

```bash
# Crear script de backup
mkdir -p scripts
cat > scripts/backup-db.sh << 'EOF'
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker-compose exec -T postgres pg_dump -U postgres asset_management > backups/backup_$TIMESTAMP.sql
echo "Backup completado: backups/backup_$TIMESTAMP.sql"
EOF

chmod +x scripts/backup-db.sh

# Programar ejecución diaria (crontab)
crontab -e
# Agregar línea: 0 2 * * * /ruta/al/scripts/backup-db.sh
```

---

## 🎓 Próximos Pasos

1. Personalizar categorías según tu negocio
2. Agregar más usuarios
3. Configurar LDAP/AD si es necesario
4. Integrar con sistemas contables
5. Configurar alertas y notificaciones
6. Establecer políticas de respaldo

---

## 📞 Soporte

Si hay errores:

1. Revisar logs: `docker-compose logs`
2. Verificar conectividad: `curl http://localhost/health`
3. Revisar base de datos: `docker-compose exec postgres psql -U postgres -d asset_management -c "SELECT * FROM users;"`

---

**¡Sistema listo para usar! 🎉**
