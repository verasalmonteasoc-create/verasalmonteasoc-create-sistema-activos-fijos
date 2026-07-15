"""
Rutas de Configuración Contable
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
from decimal import Decimal
from backend.models import db, ChartOfAccounts, JournalEntry, Asset, AssetCategory

accounting_bp = Blueprint('accounting', __name__, url_prefix='/api/accounting')


@accounting_bp.route('/accounts', methods=['GET'])
def get_accounts():
    """Listar todas las cuentas contables"""
    accounts = ChartOfAccounts.query.order_by(ChartOfAccounts.code).all()
    return jsonify({
        'success': True,
        'accounts': [{
            'id': acc.id,
            'code': acc.code,
            'name': acc.name,
            'account_type': acc.account_type,
            'description': acc.description
        } for acc in accounts]
    }), 200


@accounting_bp.route('/accounts', methods=['POST'])
def create_account():
    """Crear nueva cuenta contable"""
    data = request.get_json()

    required_fields = ['code', 'name', 'account_type']
    if not all(field in data for field in required_fields):
        return jsonify({'success': False, 'message': 'Campos requeridos faltantes'}), 400

    # Verificar código único
    existing = ChartOfAccounts.query.filter_by(code=data['code']).first()
    if existing:
        return jsonify({'success': False, 'message': 'El código de cuenta ya existe'}), 400

    account = ChartOfAccounts(
        code=data['code'],
        name=data['name'],
        account_type=data['account_type'],
        description=data.get('description', '')
    )

    db.session.add(account)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Cuenta creada exitosamente',
        'account': {
            'id': account.id,
            'code': account.code,
            'name': account.name,
            'account_type': account.account_type,
            'description': account.description
        }
    }), 201


@accounting_bp.route('/accounts/<int:account_id>', methods=['PUT'])
def update_account(account_id):
    """Actualizar cuenta contable"""
    account = ChartOfAccounts.query.get_or_404(account_id)
    data = request.get_json()

    if 'code' in data and data['code'] != account.code:
        existing = ChartOfAccounts.query.filter_by(code=data['code']).first()
        if existing:
            return jsonify({'success': False, 'message': 'El código de cuenta ya existe'}), 400
        account.code = data['code']

    if 'name' in data:
        account.name = data['name']
    if 'account_type' in data:
        account.account_type = data['account_type']
    if 'description' in data:
        account.description = data['description']

    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Cuenta actualizada',
        'account': {
            'id': account.id,
            'code': account.code,
            'name': account.name,
            'account_type': account.account_type,
            'description': account.description
        }
    }), 200


@accounting_bp.route('/accounts/<int:account_id>', methods=['DELETE'])
def delete_account(account_id):
    """Eliminar cuenta contable"""
    account = ChartOfAccounts.query.get_or_404(account_id)

    # Verificar si está en uso
    in_use = JournalEntry.query.filter(
        (JournalEntry.debit_account_id == account_id) |
        (JournalEntry.credit_account_id == account_id)
    ).first()

    if in_use:
        return jsonify({
            'success': False,
            'message': 'No se puede eliminar: la cuenta está en uso en asientos contables'
        }), 400

    db.session.delete(account)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Cuenta eliminada'
    }), 200


@accounting_bp.route('/journal', methods=['GET'])
def get_journal_entries():
    """Listar asientos contables"""
    year = request.args.get('year', type=int)
    month = request.args.get('month', type=int)

    query = JournalEntry.query

    if year:
        query = query.filter_by(year=year)
    if month:
        query = query.filter_by(month=month)

    entries = query.order_by(JournalEntry.entry_date.desc()).all()

    return jsonify({
        'success': True,
        'entries': [{
            'id': e.id,
            'entry_date': e.entry_date.isoformat(),
            'description': e.description,
            'debit_account': {
                'code': e.debit_account.code if e.debit_account else '',
                'name': e.debit_account.name if e.debit_account else ''
            } if e.debit_account else None,
            'credit_account': {
                'code': e.credit_account.code if e.credit_account else '',
                'name': e.credit_account.name if e.credit_account else ''
            } if e.credit_account else None,
            'amount': float(e.amount),
            'year': e.year,
            'month': e.month
        } for e in entries]
    }), 200


@accounting_bp.route('/journal/generate', methods=['POST'])
def generate_journal_entries():
    """Generar asientos contables automáticos para depreciación"""
    data = request.get_json()
    year = data.get('year', datetime.now().year)
    month = data.get('month', datetime.now().month)

    # Obtener todos los activos activos
    assets = Asset.query.filter_by(status='active').all()

    created_entries = []

    for asset in assets:
        if asset.is_fully_depreciated():
            continue

        # Calcular depreciación del mes
        monthly_depreciation = Decimal(str(asset.get_monthly_depreciation()))

        # Obtener cuentas de la categoría
        category = asset.category
        if not category.depreciation_expense_account or not category.accumulated_depreciation_account:
            continue

        # Buscar cuentas
        expense_account = ChartOfAccounts.query.filter_by(code=category.depreciation_expense_account).first()
        accumulated_account = ChartOfAccounts.query.filter_by(code=category.accumulated_depreciation_account).first()

        if not expense_account or not accumulated_account:
            continue

        # Crear asiento
        entry = JournalEntry(
            entry_date=datetime(year, month, 1).date(),
            description=f'Depreciación: {asset.code} - {asset.description}',
            debit_account_id=expense_account.id,
            credit_account_id=accumulated_account.id,
            amount=monthly_depreciation,
            asset_id=asset.id,
            year=year,
            month=month
        )

        db.session.add(entry)
        created_entries.append(entry)

    db.session.commit()

    return jsonify({
        'success': True,
        'message': f'{len(created_entries)} asientos generados',
        'entries_created': len(created_entries)
    }), 201
