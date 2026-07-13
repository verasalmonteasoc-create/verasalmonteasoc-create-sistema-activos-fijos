"""
Rutas de Reportes
"""
from flask import Blueprint, request, jsonify, send_file
from flask_login import login_required
from datetime import datetime
from decimal import Decimal
from backend.models import db, Asset, AssetCategory, DepreciationRecord
from io import BytesIO
import csv

reports_bp = Blueprint('reports', __name__, url_prefix='/api/reports')


@reports_bp.route('/assets-summary', methods=['GET'])
def get_assets_summary():
    """Resumen general de activos"""
    total_assets = Asset.query.count()
    active_assets = Asset.query.filter_by(status='active').count()
    inactive_assets = Asset.query.filter_by(status='inactive').count()
    retired_assets = Asset.query.filter_by(status='retired').count()

    total_cost = db.session.query(db.func.sum(Asset.acquisition_cost)).scalar() or 0
    total_depreciation = 0
    total_net_value = 0

    for asset in Asset.query.all():
        total_depreciation += asset.get_accumulated_depreciation()
        total_net_value += asset.get_net_book_value()

    return jsonify({
        'success': True,
        'summary': {
            'total_assets': total_assets,
            'active_assets': active_assets,
            'inactive_assets': inactive_assets,
            'retired_assets': retired_assets,
            'total_acquisition_cost': float(total_cost),
            'total_accumulated_depreciation': total_depreciation,
            'total_net_book_value': total_net_value
        }
    }), 200


@reports_bp.route('/by-category', methods=['GET'])
def get_by_category():
    """Reporte de activos por categoría"""
    categories = AssetCategory.query.all()
    report = []

    for cat in categories:
        assets = Asset.query.filter_by(category_id=cat.id).all()
        total_cost = sum(float(a.acquisition_cost) for a in assets)
        total_depreciation = sum(a.get_accumulated_depreciation() for a in assets)
        total_net_value = sum(a.get_net_book_value() for a in assets)

        report.append({
            'category': cat.name,
            'depreciation_rate': float(cat.depreciation_rate),
            'asset_count': len(assets),
            'total_acquisition_cost': total_cost,
            'total_accumulated_depreciation': total_depreciation,
            'total_net_book_value': total_net_value
        })

    return jsonify({
        'success': True,
        'report': report
    }), 200


@reports_bp.route('/by-department', methods=['GET'])
def get_by_department():
    """Reporte de activos por departamento"""
    assets = Asset.query.all()
    departments = {}

    for asset in assets:
        dept = asset.department or 'Sin departamento'
        if dept not in departments:
            departments[dept] = []
        departments[dept].append(asset)

    report = []
    for dept, assets_list in departments.items():
        total_cost = sum(float(a.acquisition_cost) for a in assets_list)
        total_depreciation = sum(a.get_accumulated_depreciation() for a in assets_list)
        total_net_value = sum(a.get_net_book_value() for a in assets_list)

        report.append({
            'department': dept,
            'asset_count': len(assets_list),
            'total_acquisition_cost': total_cost,
            'total_accumulated_depreciation': total_depreciation,
            'total_net_book_value': total_net_value
        })

    return jsonify({
        'success': True,
        'report': sorted(report, key=lambda x: x['total_acquisition_cost'], reverse=True)
    }), 200


@reports_bp.route('/depreciation', methods=['GET'])
def get_depreciation_report():
    """Reporte de depreciación por período"""
    year = request.args.get('year', datetime.utcnow().year, type=int)
    month = request.args.get('month', type=int)

    query = DepreciationRecord.query.filter_by(year=year)
    if month:
        query = query.filter_by(month=month)

    records = query.order_by(
        DepreciationRecord.asset_id,
        DepreciationRecord.month
    ).all()

    total_depreciation = sum(float(r.depreciation_amount) for r in records)

    return jsonify({
        'success': True,
        'period': {
            'year': year,
            'month': month
        },
        'total_depreciation': total_depreciation,
        'records': [{
            'asset_code': r.asset.code,
            'asset_description': r.asset.description,
            'category': r.asset.category.name,
            'month_year': r.get_display_month(),
            'depreciation_amount': float(r.depreciation_amount),
            'accumulated_depreciation': float(r.accumulated_depreciation),
            'net_book_value': float(r.net_book_value)
        } for r in records],
        'record_count': len(records)
    }), 200


@reports_bp.route('/depreciation-schedule/<int:asset_id>', methods=['GET'])
def get_depreciation_schedule(asset_id):
    """Cronograma de depreciación de un activo"""
    asset = Asset.query.get_or_404(asset_id)
    records = DepreciationRecord.query.filter_by(asset_id=asset_id).order_by(
        DepreciationRecord.year,
        DepreciationRecord.month
    ).all()

    return jsonify({
        'success': True,
        'asset': {
            'code': asset.code,
            'description': asset.description,
            'category': asset.category.name,
            'acquisition_cost': float(asset.acquisition_cost),
            'acquisition_date': asset.acquisition_date.isoformat(),
            'useful_life_years': asset.useful_life_years,
            'monthly_depreciation': asset.get_monthly_depreciation(),
            'status': asset.status
        },
        'schedule': [{
            'month_year': r.get_display_month(),
            'depreciation_amount': float(r.depreciation_amount),
            'accumulated_depreciation': float(r.accumulated_depreciation),
            'net_book_value': float(r.net_book_value)
        } for r in records]
    }), 200


@reports_bp.route('/aging-analysis', methods=['GET'])
def get_aging_analysis():
    """Análisis de antigüedad de activos"""
    today = datetime.utcnow().date()
    assets = Asset.query.filter_by(status='active').all()

    # Categorizar por antigüedad
    ranges = {
        'menos_1_ano': {'label': 'Menos de 1 año', 'min': 0, 'max': 365},
        '1_a_3_anos': {'label': '1 a 3 años', 'min': 366, 'max': 1095},
        '3_a_5_anos': {'label': '3 a 5 años', 'min': 1096, 'max': 1825},
        'mas_5_anos': {'label': 'Más de 5 años', 'min': 1826, 'max': 999999}
    }

    for range_key in ranges:
        ranges[range_key]['assets'] = []
        ranges[range_key]['total_cost'] = 0
        ranges[range_key]['total_net_value'] = 0

    for asset in assets:
        days_old = (today - asset.acquisition_date).days
        cost = float(asset.acquisition_cost)
        net_value = asset.get_net_book_value()

        for range_key, range_info in ranges.items():
            if range_info['min'] <= days_old <= range_info['max']:
                range_info['assets'].append({
                    'code': asset.code,
                    'description': asset.description,
                    'days_old': days_old,
                    'acquisition_cost': cost,
                    'net_book_value': net_value
                })
                range_info['total_cost'] += cost
                range_info['total_net_value'] += net_value
                break

    report = [{
        'range': ranges[key]['label'],
        'asset_count': len(ranges[key]['assets']),
        'total_acquisition_cost': ranges[key]['total_cost'],
        'total_net_book_value': ranges[key]['total_net_value'],
        'assets': ranges[key]['assets']
    } for key in ranges]

    return jsonify({
        'success': True,
        'analysis_date': today.isoformat(),
        'report': report
    }), 200


@reports_bp.route('/export/csv', methods=['GET'])
def export_csv():
    """Exportar activos a CSV"""
    assets = Asset.query.all()

    # Crear CSV en memoria
    output = BytesIO()
    writer = csv.writer(output)

    # Encabezados
    writer.writerow([
        'Código', 'Descripción', 'Categoría', 'Fecha Adquisición', 'Costo Adquisición',
        'Depreciación Acumulada', 'Valor Neto en Libros', 'Departamento', 'Responsable', 'Estado'
    ])

    # Datos
    for asset in assets:
        writer.writerow([
            asset.code,
            asset.description,
            asset.category.name,
            asset.acquisition_date.isoformat(),
            float(asset.acquisition_cost),
            asset.get_accumulated_depreciation(),
            asset.get_net_book_value(),
            asset.department or '',
            asset.responsible or '',
            asset.status
        ])

    output.seek(0)
    return send_file(
        output,
        mimetype='text/csv',
        as_attachment=True,
        download_name=f'activos_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}.csv'
    )


@reports_bp.route('/depreciation-forecast/<int:months>', methods=['GET'])
def get_depreciation_forecast(months):
    """Proyección de depreciación futura"""
    if months < 1 or months > 120:
        return jsonify({'success': False, 'message': 'Meses debe estar entre 1 y 120'}), 400

    assets = Asset.query.filter_by(status='active').all()
    forecast = []

    for i in range(1, months + 1):
        total_monthly = 0
        for asset in assets:
            if not asset.is_fully_depreciated():
                total_monthly += asset.get_monthly_depreciation()

        forecast.append({
            'month': i,
            'forecasted_depreciation': total_monthly
        })

    return jsonify({
        'success': True,
        'forecast_months': months,
        'forecast': forecast
    }), 200
