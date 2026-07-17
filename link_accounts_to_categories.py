# -*- coding: utf-8 -*-
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')

from dotenv import load_dotenv
load_dotenv()

from backend.app import app
from backend.models import db, AssetCategory, ChartOfAccounts

def link_accounts():
    with app.app_context():
        try:
            categories = AssetCategory.query.all()
            depreciation_accounts = ChartOfAccounts.query.filter(
                ChartOfAccounts.name.ilike('%Deprec%')
            ).all()

            print("=== Cuentas de Depreciacion ===")
            for acc in depreciation_accounts[:10]:
                print(f"{acc.code} | {acc.name}")

            if depreciation_accounts:
                gasto_deprec = depreciation_accounts[0]
                print(f"\n[OK] Cuenta de Gasto: {gasto_deprec.code}")

                acumulada_deprec = None
                for acc in depreciation_accounts:
                    if 'Acumulada' in acc.name or 'acumulada' in acc.name:
                        acumulada_deprec = acc
                        break

                if not acumulada_deprec and len(depreciation_accounts) > 1:
                    acumulada_deprec = depreciation_accounts[1]

                if acumulada_deprec:
                    print(f"[OK] Cuenta Acumulada: {acumulada_deprec.code}")

                    for cat in categories:
                        cat.depreciation_expense_account = gasto_deprec.code
                        cat.accumulated_depreciation_account = acumulada_deprec.code
                        print(f"  - Actualizada: {cat.name}")

                    db.session.commit()
                    print("\n[OK] Cuentas vinculadas correctamente!")
                else:
                    print("[ERROR] No hay cuenta acumulada disponible")
            else:
                print("[ERROR] No hay cuentas de depreciation en el sistema")

        except Exception as e:
            print(f"[ERROR] {str(e)}")
            db.session.rollback()

if __name__ == '__main__':
    link_accounts()
