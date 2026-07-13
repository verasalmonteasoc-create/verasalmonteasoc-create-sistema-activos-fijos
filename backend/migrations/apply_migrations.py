#!/usr/bin/env python3
"""
Script para aplicar migraciones a la base de datos
"""
import sys
import os
sys.path.insert(0, '/app')

from sqlalchemy import create_engine, text
from backend.config import get_config

def run_migrations():
    """Ejecutar migraciones SQL"""
    db_user = os.getenv('DB_USER', 'postgres')
    db_password = os.getenv('DB_PASSWORD', 'postgres123')
    db_host = os.getenv('DB_HOST', 'postgres')
    db_port = os.getenv('DB_PORT', '5432')
    db_name = os.getenv('DB_NAME', 'asset_management')

    db_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    engine = create_engine(db_url)

    try:
        with engine.connect() as conn:
            # Agregar columnas a asset_categories
            conn.execute(text('''
                ALTER TABLE IF EXISTS asset_categories
                ADD COLUMN IF NOT EXISTS asset_account VARCHAR(50),
                ADD COLUMN IF NOT EXISTS asset_account_name VARCHAR(255),
                ADD COLUMN IF NOT EXISTS accumulated_depreciation_account VARCHAR(50),
                ADD COLUMN IF NOT EXISTS depreciation_expense_account VARCHAR(50);
            '''))

            # Agregar columnas a assets
            conn.execute(text('''
                ALTER TABLE IF EXISTS assets
                ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(255),
                ADD COLUMN IF NOT EXISTS fiscal_receipt_number VARCHAR(50);
            '''))

            conn.commit()
            print('✓ Migraciones ejecutadas correctamente')
            return True
    except Exception as e:
        print(f'✓ Migraciones ya aplicadas o error: {e}')
        return False

if __name__ == '__main__':
    run_migrations()
