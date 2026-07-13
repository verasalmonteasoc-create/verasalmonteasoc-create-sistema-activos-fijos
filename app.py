"""
Aplicación Flask - Sistema de Gestión de Activos Fijos
"""
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_login import LoginManager
from datetime import datetime
import logging
import os

# Importaciones locales
from config import get_config
from models import db, User, Asset, AssetCategory, DepreciationRecord, AuditLog

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def create_app(config=None):
    """Factory function para crear la aplicación Flask"""
    app = Flask(__name__)

    # Cargar configuración
    if config is None:
        config = get_config()
    app.config.from_object(config)

    # Inicializar extensiones
    db.init_app(app)
    login_manager = LoginManager()
    login_manager.init_app(app)
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
            db.session.execute('SELECT 1')
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

    return app


def register_blueprints(app):
    """Registrar blueprints de rutas"""
    from routes.auth import auth_bp
    from routes.assets import assets_bp
    from routes.categories import categories_bp
    from routes.reports import reports_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(assets_bp)
    app.register_blueprint(categories_bp)
    app.register_blueprint(reports_bp)


# Crear aplicación
app = create_app()


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
