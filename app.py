"""
Punto de entrada local del Sistema de Gestión de Activos Fijos.

IMPORTANTE: la lógica real vive en backend/app.py (que es lo que usa producción
con gunicorn `backend.app:app`). Este archivo solo carga el .env y reexporta esa
misma aplicación, para que correr `python app.py` en local sea IDÉNTICO a
producción y no existan dos factories divergentes.
"""
from dotenv import load_dotenv

# El .env debe cargarse ANTES de importar backend.app (que lee la config al importarse)
load_dotenv()

from backend.app import app, create_app  # noqa: E402  (import tras load_dotenv, a propósito)

if __name__ == '__main__':
    import os
    port = int(os.getenv('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
