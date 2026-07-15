"""
Rutas de Categorías de Activos
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
from backend.models import db, AssetCategory, Asset

categories_bp = Blueprint('categories', __name__, url_prefix='/api/categories')


@categories_bp.route('', methods=['GET'])
def get_categories():
    """Listar categorías de activos"""
    categories = AssetCategory.query.order_by(AssetCategory.name).all()
    return jsonify({
        'success': True,
        'categories': [{
            'id': cat.id,
            'name': cat.name,
            'depreciation_rate': float(cat.depreciation_rate),
            'description': cat.description,
            'asset_account': cat.asset_account,
            'asset_account_name': cat.asset_account_name,
            'accumulated_depreciation_account': cat.accumulated_depreciation_account,
            'depreciation_expense_account': cat.depreciation_expense_account
        } for cat in categories]
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
            'depreciation_expense_account': category.depreciation_expense_account
        }
    }), 200


@categories_bp.route('', methods=['POST'])
def create_category():
    """Crear nueva categoría"""
    data = request.get_json()

    required_fields = ['name', 'depreciation_rate']
    if not all(field in data for field in required_fields):
        return jsonify({'success': False, 'message': 'Campos requeridos faltantes'}), 400

    # Verificar nombre único
    existing = AssetCategory.query.filter_by(name=data['name']).first()
    if existing:
        return jsonify({'success': False, 'message': 'La categoría ya existe'}), 400

    category = AssetCategory(
        name=data['name'],
        depreciation_rate=data['depreciation_rate'],
        description=data.get('description', ''),
        asset_account=data.get('asset_account'),
        asset_account_name=data.get('asset_account_name'),
        accumulated_depreciation_account=data.get('accumulated_depreciation_account'),
        depreciation_expense_account=data.get('depreciation_expense_account')
    )

    db.session.add(category)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Categoría creada exitosamente',
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

    if 'name' in data:
        # Verificar que el nuevo nombre sea único (si cambió)
        if data['name'] != category.name:
            existing = AssetCategory.query.filter_by(name=data['name']).first()
            if existing:
                return jsonify({'success': False, 'message': 'La categoría ya existe'}), 400
        category.name = data['name']

    if 'depreciation_rate' in data:
        category.depreciation_rate = data['depreciation_rate']

    if 'description' in data:
        category.description = data['description']

    if 'asset_account' in data:
        category.asset_account = data['asset_account']

    if 'asset_account_name' in data:
        category.asset_account_name = data['asset_account_name']

    if 'accumulated_depreciation_account' in data:
        category.accumulated_depreciation_account = data['accumulated_depreciation_account']

    if 'depreciation_expense_account' in data:
        category.depreciation_expense_account = data['depreciation_expense_account']

    category.updated_at = datetime.utcnow()
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

    # Verificar si hay activos en esta categoría
    asset_count = Asset.query.filter_by(category_id=category_id).count()
    if asset_count > 0:
        return jsonify({
            'success': False,
            'message': f'No se puede eliminar: hay {asset_count} activos en esta categoría'
        }), 400

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

    assets_page = Asset.query.filter_by(category_id=category_id).paginate(
        page=page, per_page=per_page
    )

    return jsonify({
        'success': True,
        'category': category.name,
        'assets': [{
            'id': a.id,
            'code': a.code,
            'description': a.description,
            'acquisition_cost': float(a.acquisition_cost),
            'status': a.status
        } for a in assets_page.items],
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': assets_page.total,
            'pages': assets_page.pages
        }
    }), 200
