"""
Rutas de Configuración Contable
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
from decimal import Decimal
from backend.models import db, ChartOfAccounts, JournalEntry, Asset, AssetCategory, AuditLog

accounting_bp = Blueprint('accounting', __name__, url_prefix='/api/accounting')


@accounting_bp.route('/accounts', methods=['GET'])
def get_accounts():
    """Listar todas las cuentas"""
    accounts = ChartOfAccounts.query.all()
    return jsonify({
        'success': True,
        'accounts': [{
            'id': a.id,
            'code': a.code,
            'name': a.name,
            'account_type': a.account_type,
            'description': a.description
        } for a in accounts]
    }), 200


@accounting_bp.route('/accounts', methods=['POST'])
def create_account():
    """Crear nueva cuenta"""
    data = request.get_json()

    if not data or not data.get('code') or not data.get('name'):
        return jsonify({'success': False, 'message': 'Campos requeridos faltantes'}), 400

    if ChartOfAccounts.query.filter_by(code=data['code']).first():
        return jsonify({'success': False, 'message': 'Código de cuenta ya existe'}), 409

    account = ChartOfAccounts(
        code=data['code'],
        name=data['name'],
        account_type=data.get('account_type', 'Activo'),
        description=data.get('description', '')
    )

    db.session.add(account)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Cuenta creada',
        'account': {
            'id': account.id,
            'code': account.code,
            'name': account.name,
            'account_type': account.account_type
        }
    }), 201


@accounting_bp.route('/accounts/<int:account_id>', methods=['PUT'])
def update_account(account_id):
    """Actualizar cuenta"""
    account = ChartOfAccounts.query.get_or_404(account_id)
    data = request.get_json()

    if 'name' in data:
        account.name = data['name']
    if 'account_type' in data:
        account.account_type = data['account_type']
    if 'description' in data:
        account.description = data['description']

    account.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Cuenta actualizada',
        'account': {
            'id': account.id,
            'code': account.code,
            'name': account.name,
            'account_type': account.account_type
        }
    }), 200


@accounting_bp.route('/accounts/<int:account_id>', methods=['DELETE'])
def delete_account(account_id):
    """Eliminar cuenta"""
    account = ChartOfAccounts.query.get_or_404(account_id)

    # Verificar si está en uso
    if JournalEntry.query.filter((JournalEntry.debit_account_id == account_id) | (JournalEntry.credit_account_id == account_id)).first():
        return jsonify({
            'success': False,
            'message': 'No se puede eliminar. Cuenta está en uso en asientos'
        }), 409

    db.session.delete(account)
    db.session.commit()

    return jsonify({'success': True, 'message': 'Cuenta eliminada'}), 200


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
            'debit_account': e.debit_account.name if e.debit_account else '',
            'credit_account': e.credit_account.name if e.credit_account else '',
            'amount': float(e.amount),
            'year': e.year,
            'month': e.month
        } for e in entries]
    }), 200


@accounting_bp.route('/journal/generate', methods=['POST'])
def generate_journal_entries():
    """Generar asientos contables del mes"""
    data = request.get_json()
    year = data.get('year')
    month = data.get('month')

    if not year or not month:
        return jsonify({'success': False, 'message': 'Año y mes requeridos'}), 400

    # Verificar si ya existen asientos para este mes
    existing = JournalEntry.query.filter_by(year=year, month=month).first()
    if existing:
        return jsonify({'success': False, 'message': 'Los asientos para este mes ya fueron generados'}), 409

    # Obtener depreciaciones del mes
    from backend.models import DepreciationRecord
    depreciations = DepreciationRecord.query.filter_by(year=year, month=month).all()

    if not depreciations:
        return jsonify({'success': False, 'message': 'No hay depreciaciones registradas para este período'}), 400

    total_depreciation = Decimal('0')
    entries_created = 0

    try:
        for dep in depreciations:
            asset = Asset.query.get(dep.asset_id)
            if not asset:
                continue

            category = asset.category
            total_depreciation += dep.depreciation_amount

            # Buscar cuentas contables de la categoría
            debit_account = ChartOfAccounts.query.filter_by(code=category.depreciation_expense_account).first() if category.depreciation_expense_account else None
            credit_account = ChartOfAccounts.query.filter_by(code=category.accumulated_depreciation_account).first() if category.accumulated_depreciation_account else None

            if debit_account and credit_account:
                entry = JournalEntry(
                    entry_date=datetime.utcnow().date(),
                    description=f'Depreciación {asset.code} - {asset.description}',
                    debit_account_id=debit_account.id,
                    credit_account_id=credit_account.id,
                    amount=dep.depreciation_amount,
                    asset_id=dep.asset_id,
                    year=year,
                    month=month
                )
                db.session.add(entry)
                entries_created += 1

        db.session.commit()

        return jsonify({
            'success': True,
            'message': f'{entries_created} asientos generados',
            'total_depreciation': float(total_depreciation),
            'entries_count': entries_created
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
