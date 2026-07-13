"""
Routes package initialization
Para ubicar en: backend/routes/__init__.py
"""

from .auth import auth_bp
from .assets import assets_bp
from .categories import categories_bp
from .reports import reports_bp

__all__ = ['auth_bp', 'assets_bp', 'categories_bp', 'reports_bp']
