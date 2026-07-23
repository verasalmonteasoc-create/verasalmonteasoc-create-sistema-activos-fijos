from flask import Blueprint, jsonify, request
from flask_login import login_required
from backend.models import db, Department
import openpyxl
import tempfile
import os

departments_bp = Blueprint('departments', __name__, url_prefix='/api/departments')


@departments_bp.route('', methods=['GET'])
def get_departments():
    """Obtener todos los departamentos"""
    try:
        departments = Department.query.all()
        return jsonify({
            'success': True,
            'departments': [
                {
                    'id': d.id,
                    'name': d.name,
                    'description': d.description
                }
                for d in departments
            ]
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@departments_bp.route('', methods=['POST'])
def create_department():
    """Crear un nuevo departamento"""
    try:
        data = request.get_json()

        if not data.get('name'):
            return jsonify({'success': False, 'message': 'El nombre es requerido'}), 400

        # Verificar si el departamento ya existe
        if Department.query.filter_by(name=data.get('name')).first():
            return jsonify({'success': False, 'message': 'El departamento ya existe'}), 400

        department = Department(
            name=data.get('name'),
            description=data.get('description')
        )

        db.session.add(department)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Departamento creado exitosamente',
            'department': {
                'id': department.id,
                'name': department.name,
                'description': department.description
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@departments_bp.route('/<int:id>', methods=['PUT'])
def update_department(id):
    """Actualizar un departamento"""
    try:
        department = Department.query.get_or_404(id)
        data = request.get_json()

        if 'name' in data:
            # Verificar si el nuevo nombre ya existe en otro departamento
            existing = Department.query.filter_by(name=data.get('name')).first()
            if existing and existing.id != id:
                return jsonify({'success': False, 'message': 'El nombre ya existe en otro departamento'}), 400
            department.name = data.get('name')

        if 'description' in data:
            department.description = data.get('description')

        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Departamento actualizado exitosamente',
            'department': {
                'id': department.id,
                'name': department.name,
                'description': department.description
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@departments_bp.route('/<int:id>', methods=['DELETE'])
def delete_department(id):
    """Eliminar un departamento"""
    try:
        department = Department.query.get_or_404(id)

        # Limpiar referencias en activos
        from backend.models import Asset
        Asset.query.filter_by(department_id=id).update({'department_id': None})

        db.session.delete(department)
        db.session.commit()

        return jsonify({'success': True, 'message': 'Departamento eliminado exitosamente'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@departments_bp.route('/import', methods=['POST'])
def import_departments():
    """Importar departamentos desde archivo Excel"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'message': 'No se proporcionó archivo'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'message': 'Archivo vacío'}), 400

        if not file.filename.lower().endswith(('.xlsx', '.xls')):
            return jsonify({'success': False, 'message': 'El archivo debe ser Excel (.xlsx o .xls)'}), 400

        # Guardar archivo temporalmente
        with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as tmp:
            file.save(tmp.name)
            temp_path = tmp.name

        # Cargar workbook
        wb = openpyxl.load_workbook(temp_path)
        ws = wb.active

        imported_count = 0
        errors = []
        row_num = 2  # Saltar encabezado

        # Esperamos columnas: A=Nombre, B=Descripción
        for row in ws.iter_rows(min_row=2, values_only=False):
            try:
                name = row[0].value if row[0] else None
                description = row[1].value if row[1] else None

                # Validar campos obligatorios
                if not name:
                    errors.append(f'Fila {row_num}: Nombre es obligatorio')
                    row_num += 1
                    continue

                # Convertir a string
                name = str(name).strip()
                description = str(description).strip() if description else ''

                # Verificar si ya existe
                existing = Department.query.filter_by(name=name).first()
                if existing:
                    errors.append(f'Fila {row_num}: El departamento "{name}" ya existe')
                    row_num += 1
                    continue

                # Crear departamento
                department = Department(
                    name=name,
                    description=description
                )
                db.session.add(department)
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
            'message': f'{imported_count} departamentos importados exitosamente',
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
