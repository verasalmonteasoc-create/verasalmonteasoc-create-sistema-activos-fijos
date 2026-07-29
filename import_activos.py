#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Script para importar activos desde Excel"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app import create_app
from backend.models import db, Asset, AssetCategory, Department, DepreciationRecord
from decimal import Decimal
from datetime import datetime
import openpyxl

app = create_app()

def import_activos():
    """Importar activos desde Excel"""
    try:
        filepath = r"C:\Users\Edwin\Downloads\PROYECTO ACTIVOS FIJOS AUXILIAR DE EQUIPO DE TRANSPORTE.xlsx"

        print("=" * 80)
        print("IMPORTAR ACTIVOS FIJOS")
        print("=" * 80)

        wb = openpyxl.load_workbook(filepath)
        ws = wb["VEHICULOS ACTIVOS  (2)"]

        print(f"\n[OK] Archivo cargado: PROYECTO ACTIVOS FIJOS...")

        with app.app_context():
            # Obtener categoría de vehículos
            vehicle_cat = AssetCategory.query.filter_by(name='Vehiculos y Camiones Livianos').first()
            if not vehicle_cat:
                print("[ERR] Categoría 'Vehiculos y Camiones Livianos' no encontrada")
                return

            print(f"  Category: {vehicle_cat.name}")

            # Eliminar activos anteriores
            print(f"\n[DELETE] Eliminando activos anteriores...")
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

            # Importar activos
            print(f"\n[IMPORT] Importando activos...")
            imported = 0
            errors = []
            total_cost = 0
            total_depreciation = 0

            for idx, row in enumerate(ws.iter_rows(values_only=True), 1):
                if idx <= 2:  # Skip encabezados
                    continue

                try:
                    marca = row[0]  # MARCA
                    modelo = row[1]  # MODELO
                    departamento = row[2]  # DEPARTAMENTO
                    color = row[3]  # COLOR
                    year = row[4]  # AÑO
                    status = row[5]  # STATUS
                    categoria = row[6]  # CATEGORIA
                    chasis = row[8]  # CHASIS
                    usuario = row[9]  # USUARIO
                    fecha_adq = row[10]  # FECHA DE ADQUISCION
                    costo = row[11]  # COSTO DE ADQUISCION
                    depreciation_acc = row[12]  # DERPRECIACION ACUMULADA

                    if not costo or not modelo:
                        continue

                    # Get or create department
                    dept = None
                    if departamento:
                        dept = Department.query.filter_by(name=str(departamento).strip()).first()
                        if not dept:
                            dept = Department(name=str(departamento).strip())
                            db.session.add(dept)
                            db.session.flush()

                    # Parse dates
                    if isinstance(fecha_adq, datetime):
                        acq_date = fecha_adq.date()
                    else:
                        acq_date = datetime.strptime(str(fecha_adq), "%Y-%m-%d %H:%M:%S").date()

                    # Create asset
                    description = f"{marca} {modelo}" if marca else modelo
                    asset = Asset(
                        code=f"VEH-{imported+1:03d}",
                        description=str(description),
                        category_id=vehicle_cat.id,
                        acquisition_cost=Decimal(str(costo)),
                        acquisition_date=acq_date,
                        useful_life_years=4,
                        brand=str(marca) if marca else "",
                        model=str(modelo) if modelo else "",
                        color=str(color) if color else "",
                        year_manufactured=int(year) if year else None,
                        chassis=str(chasis) if chasis else "",
                        asset_user=str(usuario) if usuario else "",
                        status='active' if str(status).upper() == 'ACTIVO' else 'inactive'
                    )

                    if dept:
                        asset.department_id = dept.id

                    db.session.add(asset)
                    db.session.flush()

                    # Create depreciation record if there's accumulated depreciation
                    if depreciation_acc and float(depreciation_acc) > 0:
                        depreciation_record = DepreciationRecord(
                            asset_id=asset.id,
                            year=acq_date.year,
                            month=acq_date.month,
                            depreciation_amount=Decimal(str(depreciation_acc)),
                            accumulated_depreciation=Decimal(str(depreciation_acc)),
                            net_book_value=Decimal(str(costo)) - Decimal(str(depreciation_acc)),
                            calculated_at=datetime.now(),
                            calculated_by=None
                        )
                        db.session.add(depreciation_record)

                    total_cost += float(costo)
                    if depreciation_acc:
                        total_depreciation += float(depreciation_acc)

                    imported += 1

                    if imported % 10 == 0:
                        print(f"  {imported} activos procesados...")

                except Exception as e:
                    errors.append(f"Fila {idx}: {str(e)}")

            db.session.commit()

            print(f"\n[SUCCESS] {imported} activos importados exitosamente")

            # Show summary
            print(f"\n[SUMMARY]")
            print(f"  Total assets: {imported}")
            print(f"  Total cost: RD$ {total_cost:,.2f}")
            print(f"  Total depreciation: RD$ {total_depreciation:,.2f}")
            print(f"  Total net value: RD$ {total_cost - total_depreciation:,.2f}")

            if errors:
                print(f"\n[WARNINGS] Errores ({len(errors)}):")
                for err in errors[:5]:
                    print(f"  - {err}")

    except Exception as e:
        print(f"\n[ERROR] {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    import_activos()
