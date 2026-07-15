"""
Rutas de Gestión de Activos
"""
from flask import Blueprint, request, jsonify, send_file, send_from_directory
from flask_login import current_user, login_required
from datetime import datetime
from decimal import Decimal
from backend.models import db, Asset, AssetCategory, DepreciationRecord, AuditLog, Department
import os
import openpyxl
from werkzeug.utils import secure_filename
import tempfile

assets_bp = Blueprint('assets', __name__, url_prefix='/api/assets')


def serialize_asset(asset):
    """Convertir Asset a diccionario JSON"""
    department_name = None
    if asset.department_obj:
        department_name = asset.department_obj.name

    location_name = None
    if asset.location_obj:
        location_name = asset.location_obj.name

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
        'location_name': location_name,
        'department': department_name,
        'responsible': asset.responsible,
        'serial_number': asset.serial_number,
        'supplier_name': asset.supplier_name,
        'fiscal_receipt_number': asset.fiscal_receipt_number,
        'acquisition_year': asset.acquisition_year,
        'invoice_filename': asset.invoice_filename,
        'status': asset.status,
        'warranty': asset.warranty,
        'asset_user': asset.asset_user,
        'color': asset.color,
        'year_manufactured': asset.year_manufactured,
        'brand': asset.brand,
        'model': asset.model,
        'chassis': asset.chassis,
        'plate_number': asset.plate_number,
        'equipment_serial': asset.equipment_serial,
        'equipment_supplier': asset.equipment_supplier,
        'physical_location': asset.physical_location,
        'asset_condition': asset.asset_condition,
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
    try:
        # Manejo de FormData (con archivos) o JSON
        if request.is_json:
            data = request.get_json()
        else:
            data = request.form.to_dict()

        if not data:
            return jsonify({'success': False, 'message': 'Datos vacíos'}), 400

        invoice_filename = None

        # Manejar archivo de factura si existe
        if 'invoice_file' in request.files:
            file = request.files['invoice_file']
            if file and file.filename:
                try:
                    import os
                    from werkzeug.utils import secure_filename

                    upload_folder = os.path.join(os.path.dirname(__file__), '..', '..', 'uploads', 'invoices')
                    os.makedirs(upload_folder, exist_ok=True)

                    # Guardar con nombre seguro
                    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
                    filename = secure_filename(f"{timestamp}_{file.filename}")
                    filepath = os.path.join(upload_folder, filename)
                    file.save(filepath)
                    invoice_filename = filename
                except Exception as e:
                    return jsonify({'success': False, 'message': f'Error guardando factura: {str(e)}'}), 400

        # Validación
        required_fields = ['description', 'category_id', 'acquisition_date', 'acquisition_cost', 'useful_life_years']
        if not all(field in data for field in required_fields):
            return jsonify({'success': False, 'message': 'Campos requeridos faltantes'}), 400

        # Verificar categoría
        category = AssetCategory.query.get(data['category_id'])
        if not category:
            return jsonify({'success': False, 'message': 'Categoría no encontrada'}), 404

        # Obtener departamento si existe
        department_id = None
        if data.get('department'):
            dept = Department.query.filter_by(name=data.get('department')).first()
            if dept:
                department_id = dept.id

        # Obtener localidad si existe
        location_id = None
        if data.get('location_name'):
            from backend.models import Location
            loc = Location.query.filter_by(name=data.get('location_name')).first()
            if loc:
                location_id = loc.id

        # Crear activo
        asset = Asset(
            description=data['description'],
            category_id=data['category_id'],
            acquisition_date=datetime.fromisoformat(data['acquisition_date']).date(),
            acquisition_cost=Decimal(str(data['acquisition_cost'])),
            residual_value_percent=Decimal(str(data.get('residual_value_percent', 10))),
            useful_life_years=data['useful_life_years'],
            location=data.get('location', ''),
            location_id=location_id,
            department_id=department_id,
            responsible=data.get('responsible', ''),
            serial_number=data.get('serial_number'),
            supplier_name=data.get('supplier_name', ''),
            fiscal_receipt_number=data.get('fiscal_receipt_number', ''),
            acquisition_year=int(data.get('acquisition_year', datetime.now().year)),
            invoice_filename=invoice_filename,
            status=data.get('status', 'active'),
            warranty=data.get('warranty', ''),
            asset_user=data.get('asset_user', ''),
            color=data.get('color', ''),
            year_manufactured=int(data.get('year_manufactured', 0)) if data.get('year_manufactured') else None,
            brand=data.get('brand', ''),
            model=data.get('model', ''),
            chassis=data.get('chassis', ''),
            plate_number=data.get('plate_number', ''),
            equipment_serial=data.get('equipment_serial', ''),
            equipment_supplier=data.get('equipment_supplier', ''),
            physical_location=data.get('physical_location', ''),
            asset_condition=data.get('asset_condition', 'good'),
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

    except ValueError as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Error de validación: {str(e)}'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Error creando activo: {str(e)}'}), 500


@assets_bp.route('/<int:asset_id>', methods=['PUT'])
def update_asset(asset_id):
    """Actualizar activo"""
    try:
        asset = Asset.query.get_or_404(asset_id)
        data = request.get_json()

        if not data:
            return jsonify({'success': False, 'message': 'Datos vacíos'}), 400

        # Guardar valores anteriores
        old_values = {}

        # Campos actualizables
        updatable_fields = [
            'description', 'location', 'responsible', 'status', 'notes', 'category_id',
            'acquisition_cost', 'useful_life_years', 'warranty', 'asset_user', 'color',
            'year_manufactured', 'brand', 'model', 'chassis', 'plate_number',
            'equipment_serial', 'equipment_supplier', 'physical_location', 'asset_condition'
        ]
        for field in updatable_fields:
            if field in data:
                old_values[field] = getattr(asset, field)
                if field == 'category_id':
                    # Validar que la categoría exista
                    if not data[field]:
                        return jsonify({'success': False, 'message': 'Categoría requerida'}), 400
                    category = AssetCategory.query.get(data[field])
                    if not category:
                        return jsonify({'success': False, 'message': 'Categoría no encontrada'}), 404
                    setattr(asset, field, data[field])
                elif field == 'acquisition_cost':
                    try:
                        setattr(asset, field, Decimal(str(data[field])))
                    except:
                        return jsonify({'success': False, 'message': 'Costo de adquisición inválido'}), 400
                elif field == 'year_manufactured':
                    try:
                        value = int(data[field]) if data[field] else None
                        setattr(asset, field, value)
                    except:
                        return jsonify({'success': False, 'message': 'Año de manufactura debe ser un número'}), 400
                else:
                    setattr(asset, field, data[field])

        # Manejar departamento especialmente
        if 'department' in data:
            old_values['department'] = asset.department_obj.name if asset.department_obj else None
            if data.get('department'):
                dept = Department.query.filter_by(name=data.get('department')).first()
                if dept:
                    asset.department_id = dept.id
                else:
                    asset.department_id = None
            else:
                asset.department_id = None

        # Manejar localidad especialmente
        if 'location_name' in data:
            old_values['location_name'] = asset.location_obj.name if asset.location_obj else None
            if data.get('location_name'):
                from backend.models import Location
                loc = Location.query.filter_by(name=data.get('location_name')).first()
                if loc:
                    asset.location_id = loc.id
                else:
                    asset.location_id = None
            else:
                asset.location_id = None

        asset.updated_at = datetime.utcnow()
        db.session.commit()

        # Registrar en auditoría
        audit = AuditLog(
            user_id=1,
            entity_type='Asset',
            entity_id=asset.id,
            action='update',
            old_value=old_values,
            new_value={k: data[k] for k in (updatable_fields + ['department', 'location_name']) if k in data},
            description=f'Activo actualizado: {asset.code}'
        )
        db.session.add(audit)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Activo actualizado',
            'asset': serialize_asset(asset)
        }), 200

    except ValueError as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Error de validación: {str(e)}'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Error actualizando activo: {str(e)}'}), 500


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


@assets_bp.route('/<int:asset_id>/invoice', methods=['GET'])
def download_invoice(asset_id):
    """Descargar factura del activo"""
    asset = Asset.query.get_or_404(asset_id)

    if not asset.invoice_filename:
        return jsonify({
            'success': False,
            'message': 'No hay factura adjunta para este activo'
        }), 404

    try:
        upload_folder = os.path.join(os.path.dirname(__file__), '..', '..', 'uploads', 'invoices')
        file_path = os.path.join(upload_folder, asset.invoice_filename)

        if not os.path.exists(file_path):
            return jsonify({
                'success': False,
                'message': 'Archivo de factura no encontrado'
            }), 404

        return send_file(
            file_path,
            as_attachment=True,
            download_name=f"factura_{asset.code}_{asset.invoice_filename.split('_', 1)[1] if '_' in asset.invoice_filename else asset.invoice_filename}"
        )
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error descargando archivo: {str(e)}'
        }), 500


@assets_bp.route('/<int:asset_id>/invoice/view', methods=['GET'])
def view_invoice(asset_id):
    """Ver factura del activo (no descargar)"""
    asset = Asset.query.get_or_404(asset_id)

    if not asset.invoice_filename:
        return jsonify({
            'success': False,
            'message': 'No hay factura adjunta para este activo'
        }), 404

    try:
        upload_folder = os.path.join(os.path.dirname(__file__), '..', '..', 'uploads', 'invoices')
        file_path = os.path.join(upload_folder, asset.invoice_filename)

        if not os.path.exists(file_path):
            return jsonify({
                'success': False,
                'message': 'Archivo de factura no encontrado'
            }), 404

        return send_file(
            file_path,
            as_attachment=False
        )
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error viewing file: {str(e)}'
        }), 500


@assets_bp.route('/import', methods=['POST'])
def import_assets():
    """Importar activos desde Excel"""
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No se proporcionó archivo'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'message': 'Archivo vacío'}), 400

    if not file.filename.lower().endswith(('.xlsx', '.xls')):
        return jsonify({'success': False, 'message': 'El archivo debe ser Excel (.xlsx o .xls)'}), 400

    try:
        with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as tmp:
            file.save(tmp.name)
            temp_path = tmp.name

        wb = openpyxl.load_workbook(temp_path)
        ws = wb.active

        imported_count = 0
        errors = []
        row_num = 2

        # Columnas esperadas: A=Descripción, B=Categoría, C=Costo, D=Fecha, E=Vida Útil, F=Suplidor, G=Factura, H=NCF
        for row in ws.iter_rows(min_row=2, values_only=False):
            try:
                desc = row[0].value if row[0] else None
                cat_name = row[1].value if row[1] else None
                cost = row[2].value if row[2] else None
                acq_date = row[3].value if row[3] else None
                useful_life = row[4].value if row[4] else None
                supplier = row[5].value if row[5] else None
                invoice = row[6].value if row[6] else None
                ncf = row[7].value if row[7] else None

                # Validar campos obligatorios
                if not desc or not cat_name or not cost:
                    errors.append(f'Fila {row_num}: Faltan campos (Descripción, Categoría, Costo)')
                    row_num += 1
                    continue

                # Buscar categoría
                category = AssetCategory.query.filter_by(name=str(cat_name).strip()).first()
                if not category:
                    errors.append(f'Fila {row_num}: Categoría "{cat_name}" no encontrada')
                    row_num += 1
                    continue

                # Crear activo
                asset = Asset(
                    description=str(desc),
                    category_id=category.id,
                    acquisition_cost=Decimal(str(cost)),
                    acquisition_date=acq_date if isinstance(acq_date, datetime) else datetime.now(),
                    useful_life_years=int(useful_life) if useful_life else 5,
                    supplier_name=str(supplier) if supplier else None,
                    fiscal_receipt_number=str(ncf) if ncf else None,
                    status='active'
                )
                db.session.add(asset)
                imported_count += 1

            except Exception as e:
                errors.append(f'Fila {row_num}: {str(e)}')

            row_num += 1

        db.session.commit()
        os.unlink(temp_path)

        return jsonify({
            'success': True,
            'message': f'{imported_count} activos importados',
            'imported_count': imported_count,
            'errors': errors if errors else None
        }), 201

    except Exception as e:
        db.session.rollback()
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.unlink(temp_path)
        return jsonify({
            'success': False,
            'message': f'Error: {str(e)}'
        }), 400
