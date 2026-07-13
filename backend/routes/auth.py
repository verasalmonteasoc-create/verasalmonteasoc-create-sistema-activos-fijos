"""
Rutas de Autenticación
"""
from flask import Blueprint, request, jsonify, session
from flask_login import login_user, logout_user, current_user
from datetime import datetime
from backend.models import db, User

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.route('/login', methods=['POST'])
def login():
    """Endpoint de login"""
    data = request.get_json()

    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'success': False, 'message': 'Usuario y contraseña requeridos'}), 400

    login_id = data['username']
    user = User.query.filter((User.username == login_id) | (User.email == login_id)).first()

    if not user or not user.check_password(data['password']):
        return jsonify({'success': False, 'message': 'Usuario o contraseña incorrectos'}), 401

    if not user.active:
        return jsonify({'success': False, 'message': 'Usuario inactivo'}), 403

    # Registrar login
    user.last_login = datetime.utcnow()
    db.session.commit()

    login_user(user, remember=data.get('remember', False))

    return jsonify({
        'success': True,
        'message': 'Login exitoso',
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role,
            'first_name': user.first_name,
            'last_name': user.last_name
        }
    }), 200


@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Endpoint de logout"""
    logout_user()
    return jsonify({'success': True, 'message': 'Logout exitoso'}), 200


@auth_bp.route('/me', methods=['GET'])
def get_current_user():
    """Obtener usuario actual"""
    if current_user.is_authenticated:
        return jsonify({
            'success': True,
            'user': {
                'id': current_user.id,
                'username': current_user.username,
                'email': current_user.email,
                'role': current_user.role,
                'first_name': current_user.first_name,
                'last_name': current_user.last_name,
                'is_admin': current_user.is_admin()
            }
        }), 200
    else:
        # Devolver usuario predeterminado si no hay autenticación
        return jsonify({
            'success': True,
            'user': {
                'id': 1,
                'username': 'Usuario',
                'email': 'sistema@activos.local',
                'role': 'admin',
                'first_name': 'Usuario',
                'last_name': 'Sistema',
                'is_admin': True
            }
        }), 200


@auth_bp.route('/register', methods=['POST'])
def register():
    """Endpoint de registro (solo admin puede crear)"""
    if not current_user.is_authenticated or not current_user.is_admin():
        return jsonify({'success': False, 'message': 'Acceso denegado'}), 403

    data = request.get_json()

    if not data or not data.get('username') or not data.get('email') or not data.get('password'):
        return jsonify({'success': False, 'message': 'Campos requeridos faltantes'}), 400

    if User.query.filter_by(username=data['username']).first():
        return jsonify({'success': False, 'message': 'Usuario ya existe'}), 409

    if User.query.filter_by(email=data['email']).first():
        return jsonify({'success': False, 'message': 'Email ya existe'}), 409

    user = User(
        username=data['username'],
        email=data['email'],
        first_name=data.get('first_name', ''),
        last_name=data.get('last_name', ''),
        role=data.get('role', 'user')
    )
    user.set_password(data['password'])

    db.session.add(user)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Usuario creado exitosamente',
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email
        }
    }), 201


@auth_bp.route('/users', methods=['GET'])
def get_users():
    """Listar usuarios (solo admin)"""
    if not current_user.is_authenticated or not current_user.is_admin():
        return jsonify({'success': False, 'message': 'Acceso denegado'}), 403

    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)

    users_page = User.query.paginate(page=page, per_page=per_page)

    return jsonify({
        'success': True,
        'users': [{
            'id': u.id,
            'username': u.username,
            'email': u.email,
            'role': u.role,
            'active': u.active,
            'last_login': u.last_login.isoformat() if u.last_login else None
        } for u in users_page.items],
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': users_page.total,
            'pages': users_page.pages
        }
    }), 200


@auth_bp.route('/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    """Actualizar usuario"""
    if not current_user.is_authenticated:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user = User.query.get_or_404(user_id)

    # Solo admin o el mismo usuario pueden actualizar
    if not current_user.is_admin() and current_user.id != user_id:
        return jsonify({'success': False, 'message': 'Acceso denegado'}), 403

    data = request.get_json()

    if 'first_name' in data:
        user.first_name = data['first_name']
    if 'last_name' in data:
        user.last_name = data['last_name']
    if 'email' in data and current_user.is_admin():
        user.email = data['email']
    if 'role' in data and current_user.is_admin():
        user.role = data['role']
    if 'active' in data and current_user.is_admin():
        user.active = data['active']

    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Usuario actualizado',
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role
        }
    }), 200
