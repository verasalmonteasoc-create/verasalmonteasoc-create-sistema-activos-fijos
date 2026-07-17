"""
Rutas de Depreciación Mensual
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
from decimal import Decimal
from backend.models import db, Asset, DepreciationRecord, JournalEntry, JournalEntryLine, AssetCategory, ChartOfAccounts

depreciation_bp = Blueprint('depreciation', __name__, url_prefix='/api/depreciation')


@depreciation_bp.route('/process', methods=['POST'])
def process_monthly_depreciation():
    """Procesar depreciación mensual y generar asiento contable"""
    try:
        data = request.get_json()
        year = data.get('year')
        month = data.get('month')
        details = data.get('details', [])

        if not year or not month:
            return jsonify({'success': False, 'message': 'Año y mes requeridos'}), 400

        if not details:
            return jsonify({'success': False, 'message': 'No hay detalles de depreciación'}), 400

        # Verificar si ya existe depreciación para este período
        existing = DepreciationRecord.query.filter_by(
            asset_id=details[0]['asset_id'],
            year=year,
            month=month
        ).first()

        if existing:
            return jsonify({
                'success': False,
                'message': f'La depreciación para {month}/{year} ya fue procesada'
            }), 400

        # Agrupar por categoría para generar asientos
        categories_data = {}
        total_depreciation = Decimal('0')

        # Procesar cada activo
        for detail in details:
            asset_id = detail['asset_id']
            monthly_depreciation = Decimal(str(detail['monthlyDepreciation']))
            new_accumulated = Decimal(str(detail['newAccumulated']))

            # Crear registro de depreciación
            net_book_value = Decimal(str(detail['cost'])) - new_accumulated

            dep_record = DepreciationRecord(
                asset_id=asset_id,
                year=year,
                month=month,
                depreciation_amount=monthly_depreciation,
                accumulated_depreciation=new_accumulated,
                net_book_value=net_book_value
            )
            db.session.add(dep_record)

            # Agrupar por categoría
            asset = Asset.query.get(asset_id)
            if asset:
                cat_id = asset.category_id
                if cat_id not in categories_data:
                    categories_data[cat_id] = {
                        'category': asset.category,
                        'depreciation_amount': Decimal('0'),
                        'assets': []
                    }
                categories_data[cat_id]['depreciation_amount'] += monthly_depreciation
                categories_data[cat_id]['assets'].append(asset_id)

            total_depreciation += monthly_depreciation

        db.session.flush()

        # Generar asiento contable único
        journal_entry = JournalEntry(
            reference=f'DEP-{year}{str(month).zfill(2)}',
            description=f'Depreciación de Activos Fijos - {_get_month_name(month)}/{year}',
            entry_date=datetime.now().date(),
            entry_type='depreciation',
            status='posted'
        )
        db.session.add(journal_entry)
        db.session.flush()

        total_debit = Decimal('0')
        total_credit = Decimal('0')

        # Crear líneas de asiento para cada categoría
        for cat_id, cat_data in categories_data.items():
            category = cat_data['category']
            dep_amount = cat_data['depreciation_amount']

            # Línea de débito: Gasto de Depreciación
            if category.depreciation_expense_account:
                debit_line = JournalEntryLine(
                    journal_entry_id=journal_entry.id,
                    account_code=category.depreciation_expense_account,
                    account_name=_get_account_name(category.depreciation_expense_account),
                    debit_amount=dep_amount,
                    credit_amount=Decimal('0'),
                    description=f'Depreciación {category.name}'
                )
                db.session.add(debit_line)
                total_debit += dep_amount

            # Línea de crédito: Depreciación Acumulada
            if category.accumulated_depreciation_account:
                credit_line = JournalEntryLine(
                    journal_entry_id=journal_entry.id,
                    account_code=category.accumulated_depreciation_account,
                    account_name=_get_account_name(category.accumulated_depreciation_account),
                    debit_amount=Decimal('0'),
                    credit_amount=dep_amount,
                    description=f'Depreciación Acumulada {category.name}'
                )
                db.session.add(credit_line)
                total_credit += dep_amount

        # Actualizar totales del asiento
        journal_entry.total_debit = total_debit
        journal_entry.total_credit = total_credit

        # Validar que debita = créditos
        if total_debit != total_credit:
            db.session.rollback()
            return jsonify({
                'success': False,
                'message': 'Error en balance del asiento contable'
            }), 400

        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Depreciación procesada exitosamente',
            'journal_entry_id': journal_entry.id,
            'total_depreciation': float(total_depreciation),
            'assets_processed': len(details),
            'reference': journal_entry.reference
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Error procesando depreciación: {str(e)}'
        }), 500


def _get_month_name(month):
    """Obtener nombre del mes en español"""
    months = {
        1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
        5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
        9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
    }
    return months.get(month, '')


def _get_account_name(account_code):
    """Obtener nombre de cuenta desde su código"""
    account = ChartOfAccounts.query.filter_by(code=account_code).first()
    return account.name if account else account_code
