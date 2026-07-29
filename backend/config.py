import os
from datetime import timedelta

class Config:
    """Configuración base"""
    # Base de datos
    DB_HOST = os.getenv('DB_HOST', 'localhost')
    DB_PORT = os.getenv('DB_PORT', 5432)
    DB_NAME = os.getenv('DB_NAME', 'asset_management')
    DB_USER = os.getenv('DB_USER', 'postgres')
    DB_PASSWORD = os.getenv('DB_PASSWORD', 'postgres123')

    SQLALCHEMY_DATABASE_URI = f'postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = False

    # Seguridad
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    SESSION_COOKIE_SECURE = False
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)

    # CORS — se lee de la variable de entorno CORS_ORIGINS (lista separada por comas)
    CORS_ORIGINS = [
        o.strip() for o in os.getenv(
            'CORS_ORIGINS',
            'http://localhost,http://localhost:80,http://localhost:3000'
        ).split(',') if o.strip()
    ]

    # Logging
    LOG_TO_STDOUT = os.getenv('LOG_TO_STDOUT', False)
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')

    # Upload
    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'backend/uploads')
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB max file size


class DevelopmentConfig(Config):
    """Configuración para desarrollo"""
    DEBUG = True
    TESTING = False
    SESSION_COOKIE_SECURE = False
    SQLALCHEMY_ECHO = True


class ProductionConfig(Config):
    """Configuración para producción"""
    DEBUG = False
    TESTING = False
    SESSION_COOKIE_SECURE = True
    SQLALCHEMY_ECHO = False
    # CORS_ORIGINS se hereda de Config (lee la variable de entorno CORS_ORIGINS)


class TestingConfig(Config):
    """Configuración para testing"""
    DEBUG = True
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False


# Seleccionar configuración según entorno
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}

def get_config():
    env = os.getenv('FLASK_ENV', 'development')
    return config.get(env, config['default'])
