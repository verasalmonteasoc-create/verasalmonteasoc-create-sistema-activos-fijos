"""
Rutas de Configuración Contable
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
from decimal import Decimal
from backend.models import db, ChartOfAccounts, JournalEntry, Asset, AssetCategory
import openpyxl
import os
from werkzeug.utils import secure_filename

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


@accounting_bp.route('/accounts/import', methods=['POST'])
def import_accounts():
    """Importar catálogo de cuentas desde Excel"""
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No se proporcionó archivo'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'message': 'Archivo vacío'}), 400

    if not file.filename.lower().endswith(('.xlsx', '.xls')):
        return jsonify({'success': False, 'message': 'El archivo debe ser Excel (.xlsx o .xls)'}), 400

    try:
        # Guardar archivo temporalmente
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as tmp:
            file.save(tmp.name)
            temp_path = tmp.name

        # Cargar workbook
        wb = openpyxl.load_workbook(temp_path)
        ws = wb.active

        imported_count = 0
        errors = []
        row_num = 2  # Saltar encabezado

        # Esperar columnas: A=Código, B=Nombre, C=Tipo, D=Descripción
        for row in ws.iter_rows(min_row=2, values_only=False):
            try:
                code = row[0].value if row[0] else None
                name = row[1].value if row[1] else None
                account_type = row[2].value if row[2] else None
                description = row[3].value if row[3] else None

                # Validar campos obligatorios
                if not code or not name or not account_type:
                    errors.append(f'Fila {row_num}: Faltan campos obligatorios (Código, Nombre, Tipo)')
                    row_num += 1
                    continue

                # Convertir a string
                code = str(code).strip()
                name = str(name).strip()
                account_type = str(account_type).strip()
                description = str(description).strip() if description else ''

                # Validar tipos de cuenta
                valid_types = ['Activo', 'Pasivo', 'Capital', 'Ingreso', 'Gasto']
                if account_type not in valid_types:
                    errors.append(f'Fila {row_num}: Tipo "{account_type}" no válido. Debe ser: {", ".join(valid_types)}')
                    row_num += 1
                    continue

                # Verificar si ya existe
                existing = ChartOfAccounts.query.filter_by(code=code).first()
                if existing:
                    errors.append(f'Fila {row_num}: El código "{code}" ya existe')
                    row_num += 1
                    continue

                # Crear cuenta
                account = ChartOfAccounts(
                    code=code,
                    name=name,
                    account_type=account_type,
                    description=description
                )
                db.session.add(account)
                imported_count += 1

            except Exception as e:
                errors.append(f'Fila {row_num}: Error procesando fila - {str(e)}')

            row_num += 1

        # Guardar cambios
        db.session.commit()

        # Limpiar archivo temporal
        os.unlink(temp_path)

        return jsonify({
            'success': True,
            'message': f'{imported_count} cuentas importadas exitosamente',
            'imported_count': imported_count,
            'errors': errors if errors else None
        }), 201

    except Exception as e:
        db.session.rollback()
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.unlink(temp_path)
        return jsonify({
            'success': False,
            'message': f'Error al procesar archivo: {str(e)}'
        }), 400


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
