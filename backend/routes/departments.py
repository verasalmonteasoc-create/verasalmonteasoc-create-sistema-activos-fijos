from flask import Blueprint, jsonify, request
from flask_login import login_required
from backend.models import db, Department

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
