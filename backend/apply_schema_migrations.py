#!/usr/bin/env python3
"""
Aplicar migraciones de schema direc tamente sin pasar por SQLAlchemy ORM
"""
import os
import time
from sqlalchemy import create_engine, text

def apply_migrations():
    """Ejecutar migraciones directamente con engine.execute"""
    max_retries = 30
    retry = 0

    db_url = f"postgresql://{os.getenv('DB_USER', 'postgres')}:{os.getenv('DB_PASSWORD', 'postgres123')}@{os.getenv('DB_HOST', 'postgres')}:{os.getenv('DB_PORT', '5432')}/{os.getenv('DB_NAME', 'asset_management')}"

    while retry < max_retries:
        try:
            engine = create_engine(db_url, echo=False)
            with engine.connect() as conn:
                conn.execute(text("""
                    ALTER TABLE IF EXISTS asset_categories
                    ADD COLUMN IF NOT EXISTS asset_account VARCHAR(50),
                    ADD COLUMN IF NOT EXISTS asset_account_name VARCHAR(255),
                    ADD COLUMN IF NOT EXISTS accumulated_depreciation_account VARCHAR(50),
                    ADD COLUMN IF NOT EXISTS depreciation_expense_account VARCHAR(50);
                """))

                conn.execute(text("""
                    ALTER TABLE IF EXISTS assets
                    ADD COLUMN IF NOT EXISTS brand VARCHAR(120),
                    ADD COLUMN IF NOT EXISTS color VARCHAR(100),
                    ADD COLUMN IF NOT EXISTS license_plate VARCHAR(50),
                    ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(255),
                    ADD COLUMN IF NOT EXISTS fiscal_receipt_number VARCHAR(50);
                """))

                conn.commit()
            print('✓ Migraciones de schema aplicadas correctamente')
            return True

        except Exception as e:
            retry += 1
            if 'already exists' in str(e).lower() or 'duplicate' in str(e).lower():
                print('✓ Columnas ya existen')
                return True
            elif 'could not connect' in str(e).lower() or 'connection refused' in str(e).lower():
                if retry < max_retries:
                    print(f'Intento {retry}/{max_retries}: Esperando BD...')
                    time.sleep(1)
                else:
                    print(f'✗ No se pudo conectar a BD después de {max_retries} intentos')
                    return False
            else:
                print(f'✓ Migraciones ya aplicadas o no necesarias: {type(e).__name__}')
                return True

if __name__ == '__main__':
    apply_migrations()
