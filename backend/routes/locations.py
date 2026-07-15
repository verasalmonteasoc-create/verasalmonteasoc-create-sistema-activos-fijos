from flask import Blueprint, jsonify, request
from flask_login import login_required
from backend.models import db, Location

locations_bp = Blueprint('locations', __name__, url_prefix='/api/locations')


@locations_bp.route('', methods=['GET'])
def get_locations():
    """Obtener todas las localidades"""
    try:
        locations = Location.query.all()
        return jsonify({
            'success': True,
            'locations': [
                {
                    'id': l.id,
                    'name': l.name,
                    'address': l.address,
                    'city': l.city,
                    'phone': l.phone,
                    'description': l.description
                }
                for l in locations
            ]
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@locations_bp.route('', methods=['POST'])
def create_location():
    """Crear una nueva localidad"""
    try:
        data = request.get_json()

        if not data.get('name'):
            return jsonify({'success': False, 'message': 'El nombre es requerido'}), 400

        # Verificar si la localidad ya existe
        if Location.query.filter_by(name=data.get('name')).first():
            return jsonify({'success': False, 'message': 'La localidad ya existe'}), 400

        location = Location(
            name=data.get('name'),
            address=data.get('address'),
            city=data.get('city'),
            phone=data.get('phone'),
            description=data.get('description')
        )

        db.session.add(location)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Localidad creada exitosamente',
            'location': {
                'id': location.id,
                'name': location.name,
                'address': location.address,
                'city': location.city,
                'phone': location.phone,
                'description': location.description
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@locations_bp.route('/<int:id>', methods=['PUT'])
def update_location(id):
    """Actualizar una localidad"""
    try:
        location = Location.query.get_or_404(id)
        data = request.get_json()

        if 'name' in data:
            # Verificar si el nuevo nombre ya existe en otra localidad
            existing = Location.query.filter_by(name=data.get('name')).first()
            if existing and existing.id != id:
                return jsonify({'success': False, 'message': 'El nombre ya existe en otra localidad'}), 400
            location.name = data.get('name')

        if 'address' in data:
            location.address = data.get('address')
        if 'city' in data:
            location.city = data.get('city')
        if 'phone' in data:
            location.phone = data.get('phone')
        if 'description' in data:
            location.description = data.get('description')

        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Localidad actualizada exitosamente',
            'location': {
                'id': location.id,
                'name': location.name,
                'address': location.address,
                'city': location.city,
                'phone': location.phone,
                'description': location.description
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@locations_bp.route('/<int:id>', methods=['DELETE'])
def delete_location(id):
    """Eliminar una localidad"""
    try:
        location = Location.query.get_or_404(id)

        # Limpiar referencias en activos
        from backend.models import Asset
        Asset.query.filter_by(location_id=id).update({'location_id': None})

        db.session.delete(location)
        db.session.commit()

        return jsonify({'success': True, 'message': 'Localidad eliminada exitosamente'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
