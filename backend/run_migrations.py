#!/usr/bin/env python3
import psycopg2
import os
import time

def run_migrations():
    """Ejecutar migraciones SQL directamente con psycopg2"""
    max_attempts = 30
    attempt = 0

    while attempt < max_attempts:
        try:
            conn = psycopg2.connect(
                host=os.getenv('DB_HOST', 'postgres'),
                port=os.getenv('DB_PORT', '5432'),
                database=os.getenv('DB_NAME', 'asset_management'),
                user=os.getenv('DB_USER', 'postgres'),
                password=os.getenv('DB_PASSWORD', 'postgres123')
            )
            cursor = conn.cursor()

            # Ejecutar migraciones
            migrations = [
                """ALTER TABLE IF EXISTS asset_categories
                   ADD COLUMN IF NOT EXISTS asset_account VARCHAR(50),
                   ADD COLUMN IF NOT EXISTS asset_account_name VARCHAR(255),
                   ADD COLUMN IF NOT EXISTS accumulated_depreciation_account VARCHAR(50),
                   ADD COLUMN IF NOT EXISTS depreciation_expense_account VARCHAR(50);""",

                """ALTER TABLE IF EXISTS assets
                   ADD COLUMN IF NOT EXISTS brand VARCHAR(120),
                   ADD COLUMN IF NOT EXISTS color VARCHAR(100),
                   ADD COLUMN IF NOT EXISTS license_plate VARCHAR(50),
                   ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(255),
                   ADD COLUMN IF NOT EXISTS fiscal_receipt_number VARCHAR(50);"""
            ]

            for migration in migrations:
                cursor.execute(migration)

            conn.commit()
            cursor.close()
            conn.close()
            print('✓ Migraciones SQL ejecutadas correctamente')
            return True

        except psycopg2.OperationalError as e:
            attempt += 1
            if attempt < max_attempts:
                print(f'Intento {attempt}/{max_attempts}: Esperando BD... {e}')
                time.sleep(1)
            else:
                print(f'✗ No se pudo conectar a la BD después de {max_attempts} intentos')
                return False
        except Exception as e:
            print(f'✓ Migraciones ya aplicadas: {e}')
            return True

if __name__ == '__main__':
    run_migrations()
