"""
Rutas de Categorías de Activos
"""
from flask import Blueprint, request, jsonify
from flask_login import current_user, login_required
from datetime import datetime
from backend.models import db, AssetCategory, AuditLog

categories_bp = Blueprint('categories', __name__, url_prefix='/api/categories')


@categories_bp.route('', methods=['GET'])
def get_categories():
    """Listar todas las categorías"""
    categories = AssetCategory.query.all()

    return jsonify({
        'success': True,
        'categories': [{
            'id': c.id,
            'name': c.name,
            'depreciation_rate': float(c.depreciation_rate),
            'description': c.description,
            'asset_account': c.asset_account,
            'asset_account_name': c.asset_account_name,
            'accumulated_depreciation_account': c.accumulated_depreciation_account,
            'depreciation_expense_account': c.depreciation_expense_account,
            'asset_count': c.assets.count()
        } for c in categories]
    }), 200


@categories_bp.route('/<int:category_id>', methods=['GET'])
def get_category(category_id):
    """Obtener categoría específica"""
    category = AssetCategory.query.get_or_404(category_id)

    return jsonify({
        'success': True,
        'category': {
            'id': category.id,
            'name': category.name,
            'depreciation_rate': float(category.depreciation_rate),
            'description': category.description,
            'asset_account': category.asset_account,
            'asset_account_name': category.asset_account_name,
            'accumulated_depreciation_account': category.accumulated_depreciation_account,
            'depreciation_expense_account': category.depreciation_expense_account,
            'asset_count': category.assets.count()
        }
    }), 200


@categories_bp.route('', methods=['POST'])
def create_category():
    """Crear nueva categoría (solo admin)"""

    data = request.get_json()

    # Validación
    if not data or not data.get('name') or not data.get('depreciation_rate'):
        return jsonify({'success': False, 'message': 'Campos requeridos faltantes'}), 400

    # Verificar duplicado
    if AssetCategory.query.filter_by(name=data['name']).first():
        return jsonify({'success': False, 'message': 'Categoría ya existe'}), 409

    category = AssetCategory(
        name=data['name'],
        depreciation_rate=data['depreciation_rate'],
        description=data.get('description', ''),
        asset_account=data.get('asset_account', ''),
        asset_account_name=data.get('asset_account_name', ''),
        accumulated_depreciation_account=data.get('accumulated_depreciation_account', ''),
        depreciation_expense_account=data.get('depreciation_expense_account', '')
    )

    db.session.add(category)
    db.session.commit()

    # Auditoría
    audit = AuditLog(
        user_id=1,
        entity_type='AssetCategory',
        entity_id=category.id,
        action='create',
        new_value={'name': category.name, 'rate': float(category.depreciation_rate)},
        description=f'Categoría creada: {category.name}'
    )
    db.session.add(audit)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Categoría creada',
        'category': {
            'id': category.id,
            'name': category.name,
            'depreciation_rate': float(category.depreciation_rate),
            'description': category.description,
            'asset_account': category.asset_account,
            'asset_account_name': category.asset_account_name,
            'accumulated_depreciation_account': category.accumulated_depreciation_account,
            'depreciation_expense_account': category.depreciation_expense_account
        }
    }), 201


@categories_bp.route('/<int:category_id>', methods=['PUT'])
def update_category(category_id):
    """Actualizar categoría"""

    category = AssetCategory.query.get_or_404(category_id)
    data = request.get_json()

    old_values = {}

    if 'name' in data:
        old_values['name'] = category.name
        category.name = data['name']

    if 'depreciation_rate' in data:
        old_values['depreciation_rate'] = float(category.depreciation_rate)
        category.depreciation_rate = data['depreciation_rate']

    if 'description' in data:
        old_values['description'] = category.description
        category.description = data['description']

    if 'asset_account' in data:
        old_values['asset_account'] = category.asset_account
        category.asset_account = data['asset_account']

    if 'asset_account_name' in data:
        old_values['asset_account_name'] = category.asset_account_name
        category.asset_account_name = data['asset_account_name']

    if 'accumulated_depreciation_account' in data:
        old_values['accumulated_depreciation_account'] = category.accumulated_depreciation_account
        category.accumulated_depreciation_account = data['accumulated_depreciation_account']

    if 'depreciation_expense_account' in data:
        old_values['depreciation_expense_account'] = category.depreciation_expense_account
        category.depreciation_expense_account = data['depreciation_expense_account']

    category.updated_at = datetime.utcnow()
    db.session.commit()

    # Auditoría
    audit = AuditLog(
        user_id=1,
        entity_type='AssetCategory',
        entity_id=category.id,
        action='update',
        old_value=old_values,
        new_value={k: data[k] for k in data if k in ['name', 'depreciation_rate', 'description', 'asset_account', 'asset_account_name', 'accumulated_depreciation_account', 'depreciation_expense_account']},
        description=f'Categoría actualizada: {category.name}'
    )
    db.session.add(audit)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Categoría actualizada',
        'category': {
            'id': category.id,
            'name': category.name,
            'depreciation_rate': float(category.depreciation_rate),
            'description': category.description,
            'asset_account': category.asset_account,
            'asset_account_name': category.asset_account_name,
            'accumulated_depreciation_account': category.accumulated_depreciation_account,
            'depreciation_expense_account': category.depreciation_expense_account
        }
    }), 200


@categories_bp.route('/<int:category_id>', methods=['DELETE'])
def delete_category(category_id):
    """Eliminar categoría"""

    category = AssetCategory.query.get_or_404(category_id)

    # Verificar si tiene activos
    if category.assets.count() > 0:
        return jsonify({
            'success': False,
            'message': f'No se puede eliminar. Categoría tiene {category.assets.count()} activos'
        }), 409

    # Auditoría
    audit = AuditLog(
        user_id=1,
        entity_type='AssetCategory',
        entity_id=category.id,
        action='delete',
        old_value={'name': category.name},
        description=f'Categoría eliminada: {category.name}'
    )
    db.session.add(audit)

    db.session.delete(category)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Categoría eliminada'
    }), 200


@categories_bp.route('/<int:category_id>/assets', methods=['GET'])
def get_category_assets(category_id):
    """Obtener activos de una categoría"""
    category = AssetCategory.query.get_or_404(category_id)
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)

    assets_page = category.assets.paginate(page=page, per_page=per_page)

    return jsonify({
        'success': True,
        'category': {
            'id': category.id,
            'name': category.name,
            'depreciation_rate': float(category.depreciation_rate)
        },
        'assets': [{
            'id': a.id,
            'code': a.code,
            'description': a.description,
            'acquisition_cost': float(a.acquisition_cost),
            'accumulated_depreciation': a.get_accumulated_depreciation(),
            'net_book_value': a.get_net_book_value(),
            'status': a.status
        } for a in assets_page.items],
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': assets_page.total,
            'pages': assets_page.pages
        }
    }), 200
