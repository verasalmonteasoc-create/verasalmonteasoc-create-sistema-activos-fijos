"""
Configuración del sistema (Fase 3):
  - Datos de la empresa / año fiscal
  - Configuración por categoría: método, tasa fiscal, cuentas contables
"""
from flask import Blueprint, request, jsonify
from flask_login import current_user
from decimal import Decimal
from backend.models import db, CompanySettings, AssetCategory

settings_bp = Blueprint('settings', __name__, url_prefix='/api/settings')


def _require_admin():
    if not current_user.is_authenticated or not current_user.is_admin():
        return jsonify({'success': False, 'message': 'Solo un administrador puede cambiar la configuración'}), 403
    return None


@settings_bp.route('/company', methods=['GET'])
def get_company():
    s = CompanySettings.get()
    return jsonify({'success': True, 'company': {
        'legal_name': s.legal_name, 'trade_name': s.trade_name, 'rnc': s.rnc,
        'address': s.address, 'city': s.city, 'phone': s.phone, 'email': s.email,
        'currency': s.currency, 'fiscal_year_start_month': s.fiscal_year_start_month
    }}), 200


@settings_bp.route('/company', methods=['PUT'])
def update_company():
    err = _require_admin()
    if err:
        return err
    s = CompanySettings.get()
    data = request.get_json() or {}
    for field in ['legal_name', 'trade_name', 'rnc', 'address', 'city', 'phone', 'email', 'currency']:
        if field in data:
            setattr(s, field, data[field])
    if 'fiscal_year_start_month' in data and data['fiscal_year_start_month']:
        s.fiscal_year_start_month = int(data['fiscal_year_start_month'])
    db.session.commit()
    return jsonify({'success': True, 'message': 'Datos de la empresa guardados'}), 200


@settings_bp.route('/categories/<int:category_id>/config', methods=['PUT'])
def update_category_config(category_id):
    """Configura método de depreciación, tasa fiscal, valores por defecto y
    cuentas contables de una categoría (determinación de cuentas explícita)."""
    err = _require_admin()
    if err:
        return err
    cat = AssetCategory.query.get_or_404(category_id)
    data = request.get_json() or {}

    if 'depreciation_method' in data and data['depreciation_method'] in ('linea_recta', 'saldos_decrecientes'):
        cat.depreciation_method = data['depreciation_method']
    if 'tax_depreciation_rate' in data:
        cat.tax_depreciation_rate = Decimal(str(data['tax_depreciation_rate'])) if data['tax_depreciation_rate'] not in (None, '') else None
    if 'default_residual_percent' in data and data['default_residual_percent'] not in (None, ''):
        cat.default_residual_percent = Decimal(str(data['default_residual_percent']))
    if 'default_useful_life' in data and data['default_useful_life'] not in (None, ''):
        cat.default_useful_life = int(data['default_useful_life'])
    # Determinación de cuentas explícita
    for field in ['asset_account', 'accumulated_depreciation_account',
                  'depreciation_expense_account', 'gain_loss_account']:
        if field in data:
            setattr(cat, field, data[field] or None)

    db.session.commit()
    return jsonify({'success': True, 'message': f'Configuración de "{cat.name}" guardada'}), 200


@settings_bp.route('/categories/config', methods=['GET'])
def list_categories_config():
    cats = AssetCategory.query.order_by(AssetCategory.name).all()
    return jsonify({'success': True, 'categories': [{
        'id': c.id, 'name': c.name,
        'depreciation_rate': float(c.depreciation_rate) if c.depreciation_rate is not None else None,
        'depreciation_method': c.depreciation_method or 'linea_recta',
        'tax_depreciation_rate': float(c.tax_depreciation_rate) if c.tax_depreciation_rate is not None else None,
        'default_residual_percent': float(c.default_residual_percent) if c.default_residual_percent is not None else None,
        'default_useful_life': c.default_useful_life,
        'asset_account': c.asset_account,
        'accumulated_depreciation_account': c.accumulated_depreciation_account,
        'depreciation_expense_account': c.depreciation_expense_account,
        'gain_loss_account': c.gain_loss_account,
    } for c in cats]}), 200
