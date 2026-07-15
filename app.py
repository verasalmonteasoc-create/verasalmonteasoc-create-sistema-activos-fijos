"""
Aplicación Flask - Sistema de Gestión de Activos Fijos
"""
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_login import LoginManager
from sqlalchemy import text
from datetime import datetime
import logging
import os
from dotenv import load_dotenv

# Cargar variables de entorno del archivo .env
load_dotenv()

# Importaciones locales
from backend.config import get_config
from backend.models import db, User, Asset, AssetCategory, DepreciationRecord, AuditLog

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def create_app(config=None):
    """Factory function para crear la aplicación Flask"""
    # Obtener ruta del frontend
    frontend_path = os.path.join(os.path.dirname(__file__), 'frontend')
    app = Flask(__name__, static_folder=frontend_path, static_url_path='')

    # Cargar configuración
    if config is None:
        config = get_config()
    app.config.from_object(config)

    # Inicializar extensiones
    db.init_app(app)
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = None
    CORS(app, origins=app.config['CORS_ORIGINS'])

    # Registrar blueprints
    register_blueprints(app)

    # Crear contexto de aplicación y crear tablas
    with app.app_context():
        try:
            db.create_all()
            logger.info("✓ Base de datos inicializada")
        except Exception as e:
            logger.error(f"✗ Error inicializando BD: {e}")

    # Manejar errores globales
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            'success': False,
            'message': 'Recurso no encontrado',
            'error': str(error)
        }), 404

    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        logger.error(f"Error interno: {error}")
        return jsonify({
            'success': False,
            'message': 'Error interno del servidor',
            'error': str(error) if app.debug else 'Error desconocido'
        }), 500

    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({
            'success': False,
            'message': 'Acceso denegado'
        }), 403

    # Login manager
    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    # Health check endpoint
    @app.route('/health', methods=['GET'])
    def health():
        try:
            db.session.execute(text('SELECT 1'))
            return jsonify({
                'status': 'healthy',
                'timestamp': datetime.utcnow().isoformat(),
                'database': 'connected'
            }), 200
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return jsonify({
                'status': 'unhealthy',
                'database': 'disconnected'
            }), 503

    # Servir archivos estáticos
    @app.route('/')
    def index():
        return send_from_directory(app.static_folder, 'index.html')

    @app.route('/<path:filename>')
    def serve_static(filename):
        return send_from_directory(app.static_folder, filename)

    return app


def register_blueprints(app):
    """Registrar blueprints de rutas"""
    from backend.routes.auth import auth_bp
    from backend.routes.assets import assets_bp
    from backend.routes.categories import categories_bp
    from backend.routes.departments import departments_bp
    from backend.routes.locations import locations_bp
    from backend.routes.reports import reports_bp
    from backend.routes.accounting import accounting_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(assets_bp)
    app.register_blueprint(categories_bp)
    app.register_blueprint(departments_bp)
    app.register_blueprint(locations_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(accounting_bp)


# Crear aplicación
app = create_app()


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
