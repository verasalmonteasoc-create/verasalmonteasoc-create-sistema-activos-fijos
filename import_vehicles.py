#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Script para importar vehículos desde Excel"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app import create_app
from backend.models import db, Asset, AssetCategory, Department, DepreciationRecord
from decimal import Decimal
from datetime import datetime

app = create_app()

def import_vehicles():
    """Importar vehículos desde Excel"""
    try:
        import openpyxl

        print("=" * 80)
        print("IMPORTAR VEHÍCULOS DE ACTIVOS FIJOS")
        print("=" * 80)

        # Cargar archivo
        filepath = "C:/Users/Edwin/Downloads/AUXILIAR DE ACTIVOS FIJOS 2025-2026 V.1 (Equipos de Transporte).xlsx"
        wb = openpyxl.load_workbook(filepath)

        # Usar la hoja "ACTIVOS VAL 0 AL 31 MARZO 2026"
        ws = wb['ACTIVOS VAL 0 AL 31 MARZO 2026 ']

        print(f"\n[OK] Archivo cargado: {os.path.basename(filepath)}")
        print(f"  Sheet: {ws.title}")

        with app.app_context():
            # Obtener categoría de vehículos
            vehicle_cat = AssetCategory.query.filter_by(name='Vehiculos y Camiones Livianos').first()
            if not vehicle_cat:
                print("[ERR] Categoría 'Vehiculos y Camiones Livianos' no encontrada")
                return

            print(f"  Category: {vehicle_cat.name}")

            # Eliminar activos anteriores de esta categoría
            print(f"\n[DELETE] Eliminando activos anteriores de esta categoría...")
            old_assets = Asset.query.filter_by(category_id=vehicle_cat.id).all()
            old_count = len(old_assets)

            # Primero eliminar registros de depreciación
            for asset in old_assets:
                DepreciationRecord.query.filter_by(asset_id=asset.id).delete()
            db.session.commit()

            # Luego eliminar activos
            Asset.query.filter_by(category_id=vehicle_cat.id).delete()
            db.session.commit()
            print(f"  [OK] {old_count} activos eliminados")

            # Importar vehículos
            print(f"\n[IMPORT] Importando vehículos...")
            imported = 0
            errors = []

            for idx, row in enumerate(ws.iter_rows(values_only=True), 1):
                if idx == 1:  # Skip header
                    continue

                try:
                    line = row[0]  # LINEA
                    model = row[1]  # MODELO
                    department = row[2]  # DEPARTAMENTO
                    color = row[3]  # COLOR
                    year = row[4]  # AÑO
                    chassis = row[5]  # CHASIS
                    user = row[6]  # USUARIO
                    acq_date = row[7]  # ADQUISICION
                    cost = row[8]  # COSTO DE ADQ

                    if not cost or not model:
                        continue

                    # Get or create department
                    dept = None
                    if department:
                        dept = Department.query.filter_by(name=str(department).strip()).first()
                        if not dept:
                            dept = Department(name=str(department).strip())
                            db.session.add(dept)
                            db.session.flush()

                    # Create asset
                    description = f"{line} {model}" if line else model
                    asset = Asset(
                        code=f"VEH-{imported+1:03d}",
                        description=str(description),
                        category_id=vehicle_cat.id,
                        acquisition_cost=Decimal(str(cost)),
                        acquisition_date=acq_date if isinstance(acq_date, datetime) else datetime.now().date(),
                        useful_life_years=4,
                        brand=str(line) if line else "",
                        model=str(model) if model else "",
                        color=str(color) if color else "",
                        year_manufactured=int(year) if year else None,
                        chassis=str(chassis) if chassis else "",
                        asset_user=str(user) if user else "",
                        status='active'
                    )

                    if dept:
                        asset.department_id = dept.id

                    db.session.add(asset)
                    imported += 1

                    if imported % 10 == 0:
                        print(f"  {imported} vehículos procesados...")

                except Exception as e:
                    errors.append(f"Fila {idx}: {str(e)}")

            db.session.commit()

            print(f"\n[SUCCESS] {imported} vehículos importados exitosamente")

            # Calcular totales
            assets = Asset.query.filter_by(category_id=vehicle_cat.id).all()
            total_cost = sum(float(a.acquisition_cost) for a in assets)
            total_net = sum(float(a.get_net_book_value()) for a in assets)

            print(f"\n[SUMMARY]")
            print(f"  Total assets: {len(assets)}")
            print(f"  Total cost: RD$ {total_cost:,.2f}")
            print(f"  Total net book value: RD$ {total_net:,.2f}")

            if errors:
                print(f"\n[WARNINGS] Errores ({len(errors)}):")
                for err in errors[:5]:
                    print(f"  - {err}")

    except Exception as e:
        print(f"\n[ERROR] {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    import_vehicles()
