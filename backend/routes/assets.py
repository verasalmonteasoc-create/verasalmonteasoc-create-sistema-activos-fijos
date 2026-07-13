"""
Rutas de Gestión de Activos
"""
from flask import Blueprint, request, jsonify
from flask_login import current_user, login_required
from datetime import datetime
from decimal import Decimal
from backend.models import db, Asset, AssetCategory, DepreciationRecord, AuditLog

assets_bp = Blueprint('assets', __name__, url_prefix='/api/assets')


def serialize_asset(asset):
    """Convertir Asset a diccionario JSON"""
    return {
        'id': asset.id,
        'code': asset.code,
        'description': asset.description,
        'category': {
            'id': asset.category.id,
            'name': asset.category.name,
            'depreciation_rate': float(asset.category.depreciation_rate)
        },
        'acquisition_date': asset.acquisition_date.isoformat(),
        'acquisition_cost': float(asset.acquisition_cost),
        'residual_value_percent': float(asset.residual_value_percent),
        'useful_life_years': asset.useful_life_years,
        'location': asset.location,
        'department': asset.department,
        'responsible': asset.responsible,
        'serial_number': asset.serial_number,
        'supplier_name': asset.supplier_name,
        'fiscal_receipt_number': asset.fiscal_receipt_number,
        'status': asset.status,
        'accumulated_depreciation': asset.get_accumulated_depreciation(),
        'net_book_value': asset.get_net_book_value(),
        'is_fully_depreciated': asset.is_fully_depreciated(),
        'created_at': asset.created_at.isoformat(),
        'updated_at': asset.updated_at.isoformat()
    }


@assets_bp.route('', methods=['GET'])
def get_assets():
    """Listar activos con filtros"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status = request.args.get('status')
    category_id = request.args.get('category_id', type=int)
    search = request.args.get('search')

    query = Asset.query

    # Filtros
    if status:
        query = query.filter_by(status=status)
    if category_id:
        query = query.filter_by(category_id=category_id)
    if search:
        query = query.filter(
            (Asset.code.ilike(f'%{search}%')) |
            (Asset.description.ilike(f'%{search}%')) |
            (Asset.serial_number.ilike(f'%{search}%'))
        )

    assets_page = query.paginate(page=page, per_page=per_page)

    return jsonify({
        'success': True,
        'assets': [serialize_asset(a) for a in assets_page.items],
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': assets_page.total,
            'pages': assets_page.pages
        }
    }), 200


@assets_bp.route('/<int:asset_id>', methods=['GET'])
def get_asset(asset_id):
    """Obtener un activo específico"""
    asset = Asset.query.get_or_404(asset_id)
    return jsonify({
        'success': True,
        'asset': serialize_asset(asset)
    }), 200


@assets_bp.route('', methods=['POST'])
def create_asset():
    """Crear nuevo activo"""
    data = request.get_json()

    # Validación
    required_fields = ['description', 'category_id', 'acquisition_date', 'acquisition_cost', 'useful_life_years']
    if not all(field in data for field in required_fields):
        return jsonify({'success': False, 'message': 'Campos requeridos faltantes'}), 400

    # Verificar categoría
    category = AssetCategory.query.get_or_404(data['category_id'])

    # Crear activo
    asset = Asset(
        description=data['description'],
        category_id=data['category_id'],
        acquisition_date=datetime.fromisoformat(data['acquisition_date']).date(),
        acquisition_cost=Decimal(str(data['acquisition_cost'])),
        residual_value_percent=Decimal(str(data.get('residual_value_percent', 10))),
        useful_life_years=data['useful_life_years'],
        location=data.get('location', ''),
        department=data.get('department', ''),
        responsible=data.get('responsible', ''),
        serial_number=data.get('serial_number'),
        supplier_name=data.get('supplier_name', ''),
        fiscal_receipt_number=data.get('fiscal_receipt_number', ''),
        status=data.get('status', 'active'),
        created_by=1,
        notes=data.get('notes', '')
    )

    db.session.add(asset)
    db.session.commit()

    # Registrar en auditoría
    audit = AuditLog(
        user_id=1,
        entity_type='Asset',
        entity_id=asset.id,
        action='create',
        new_value={'description': asset.description, 'code': asset.code},
        description=f'Activo creado: {asset.code} - {asset.description}'
    )
    db.session.add(audit)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Activo creado exitosamente',
        'asset': serialize_asset(asset)
    }), 201


@assets_bp.route('/<int:asset_id>', methods=['PUT'])
def update_asset(asset_id):
    """Actualizar activo"""
    asset = Asset.query.get_or_404(asset_id)
    data = request.get_json()

    # Guardar valores anteriores
    old_values = {}

    # Campos actualizables
    updatable_fields = ['description', 'location', 'department', 'responsible', 'status', 'notes']
    for field in updatable_fields:
        if field in data:
            old_values[field] = getattr(asset, field)
            setattr(asset, field, data[field])

    asset.updated_at = datetime.utcnow()
    db.session.commit()

    # Registrar en auditoría
    audit = AuditLog(
        user_id=1,
        entity_type='Asset',
        entity_id=asset.id,
        action='update',
        old_value=old_values,
        new_value={k: data[k] for k in updatable_fields if k in data},
        description=f'Activo actualizado: {asset.code}'
    )
    db.session.add(audit)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Activo actualizado',
        'asset': serialize_asset(asset)
    }), 200


@assets_bp.route('/<int:asset_id>', methods=['DELETE'])
def delete_asset(asset_id):
    """Eliminar activo"""
    asset = Asset.query.get_or_404(asset_id)

    # Registrar en auditoría antes de eliminar
    audit = AuditLog(
        user_id=1,
        entity_type='Asset',
        entity_id=asset.id,
        action='delete',
        old_value={'code': asset.code, 'description': asset.description},
        description=f'Activo eliminado: {asset.code}'
    )
    db.session.add(audit)

    db.session.delete(asset)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Activo eliminado'
    }), 200


@assets_bp.route('/<int:asset_id>/depreciation', methods=['GET'])
def get_asset_depreciation(asset_id):
    """Obtener historial de depreciación de un activo"""
    asset = Asset.query.get_or_404(asset_id)

    records = DepreciationRecord.query.filter_by(asset_id=asset_id).order_by(
        DepreciationRecord.year.desc(),
        DepreciationRecord.month.desc()
    ).all()

    return jsonify({
        'success': True,
        'asset': {
            'code': asset.code,
            'description': asset.description,
            'acquisition_cost': float(asset.acquisition_cost),
            'accumulated_depreciation': asset.get_accumulated_depreciation(),
            'net_book_value': asset.get_net_book_value()
        },
        'depreciation_records': [{
            'id': r.id,
            'month_year': r.get_display_month(),
            'depreciation_amount': float(r.depreciation_amount),
            'accumulated_depreciation': float(r.accumulated_depreciation),
            'net_book_value': float(r.net_book_value),
            'calculated_at': r.calculated_at.isoformat()
        } for r in records],
        'total_records': len(records)
    }), 200


@assets_bp.route('/<int:asset_id>/retire', methods=['POST'])
def retire_asset(asset_id):
    """Retiro de activo"""
    asset = Asset.query.get_or_404(asset_id)
    data = request.get_json()

    old_status = asset.status
    asset.status = 'retired'
    asset.notes = data.get('reason', '') + '\nRetirado: ' + datetime.utcnow().isoformat()

    db.session.commit()

    # Auditoría
    audit = AuditLog(
        user_id=1,
        entity_type='Asset',
        entity_id=asset.id,
        action='retire',
        old_value={'status': old_status},
        new_value={'status': 'retired'},
        description=f'Activo retirado: {asset.code}'
    )
    db.session.add(audit)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Activo retirado',
        'asset': serialize_asset(asset)
    }), 200


@assets_bp.route('/<int:asset_id>/summary', methods=['GET'])
def get_asset_summary(asset_id):
    """Obtener resumen del activo"""
    asset = Asset.query.get_or_404(asset_id)

    return jsonify({
        'success': True,
        'summary': {
            'code': asset.code,
            'description': asset.description,
            'category': asset.category.name,
            'acquisition_cost': float(asset.acquisition_cost),
            'residual_value': asset.get_residual_value(),
            'depreciable_amount': asset.get_depreciable_amount(),
            'monthly_depreciation': asset.get_monthly_depreciation(),
            'accumulated_depreciation': asset.get_accumulated_depreciation(),
            'net_book_value': asset.get_net_book_value(),
            'life_remaining_months': max(0, (asset.useful_life_years * 12) - len(
                DepreciationRecord.query.filter_by(asset_id=asset_id).all()
            )),
            'is_fully_depreciated': asset.is_fully_depreciated(),
            'status': asset.status
        }
    }), 200
