from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
from decimal import Decimal
import uuid

db = SQLAlchemy()


class User(UserMixin, db.Model):
    """Modelo de Usuario"""
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(120))
    last_name = db.Column(db.String(120))
    role = db.Column(db.String(20), default='user')  # 'admin' o 'user'
    active = db.Column(db.Boolean, default=True)
    must_change_password = db.Column(db.Boolean, default=False)  # forzar cambio en el 1er ingreso
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = db.Column(db.DateTime)

    # Relaciones
    assets_created = db.relationship('Asset', backref='creator', lazy='dynamic', foreign_keys='Asset.created_by')
    audit_logs = db.relationship('AuditLog', backref='user', lazy='dynamic')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password, method='pbkdf2:sha256')

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def is_admin(self):
        return self.role == 'admin'

    def __repr__(self):
        return f'<User {self.username}>'


class AssetCategory(db.Model):
    """Categorías de Activos"""
    __tablename__ = 'asset_categories'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False, index=True)
    depreciation_rate = db.Column(db.Numeric(5, 2), nullable=False)  # Porcentaje anual
    description = db.Column(db.Text)
    # Cuentas contables
    asset_account = db.Column(db.String(50))  # Número de cuenta de activo
    asset_account_name = db.Column(db.String(255))  # Nombre de cuenta de activo
    accumulated_depreciation_account = db.Column(db.String(50))  # Cuenta de depreciación acumulada
    depreciation_expense_account = db.Column(db.String(50))  # Cuenta de gasto de depreciación
    # Configuración de depreciación (Fase 3)
    depreciation_method = db.Column(db.String(30), default='linea_recta')  # linea_recta | saldos_decrecientes
    tax_depreciation_rate = db.Column(db.Numeric(5, 2))  # Tasa fiscal DGII (para cédula fiscal vs contable)
    default_residual_percent = db.Column(db.Numeric(5, 2), default=10)
    default_useful_life = db.Column(db.Integer)
    # Cuenta de contrapartida para ganancia/pérdida en ventas y bajas
    gain_loss_account = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    assets = db.relationship('Asset', backref='category', lazy='dynamic', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<AssetCategory {self.name}>'


class Department(db.Model):
    """Departamentos o Centros de Costo"""
    __tablename__ = 'departments'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False, index=True)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    assets = db.relationship('Asset', backref='department_obj', lazy='dynamic', foreign_keys='Asset.department_id')

    def __repr__(self):
        return f'<Department {self.name}>'


class Location(db.Model):
    """Localidades o Sucursales"""
    __tablename__ = 'locations'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False, index=True)
    address = db.Column(db.String(255))
    city = db.Column(db.String(100))
    phone = db.Column(db.String(50))
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    assets = db.relationship('Asset', backref='location_obj', lazy='dynamic', foreign_keys='Asset.location_id')

    def __repr__(self):
        return f'<Location {self.name}>'


class Asset(db.Model):
    """Modelo de Activo Fijo"""
    __tablename__ = 'assets'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    description = db.Column(db.String(255), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('asset_categories.id'), nullable=False, index=True)

    # Información financiera
    acquisition_date = db.Column(db.Date, nullable=False, index=True)
    acquisition_cost = db.Column(db.Numeric(12, 2), nullable=False)
    residual_value_percent = db.Column(db.Numeric(5, 2), default=10)  # % del costo
    useful_life_years = db.Column(db.Integer, nullable=False)

    # Información operativa
    location = db.Column(db.String(120))
    location_id = db.Column(db.Integer, db.ForeignKey('locations.id'), nullable=True, index=True)
    department_id = db.Column(db.Integer, db.ForeignKey('departments.id'), nullable=True, index=True)
    responsible = db.Column(db.String(120))
    serial_number = db.Column(db.String(100), nullable=True)
    status = db.Column(db.String(20), default='active', index=True)

    supplier_name = db.Column(db.String(255))
    fiscal_receipt_number = db.Column(db.String(50))
    acquisition_year = db.Column(db.Integer)
    invoice_filename = db.Column(db.String(255))

    # Información adicional del activo
    warranty = db.Column(db.String(100))  # Garantía (ej: "24 meses", "Vitalicia")
    asset_user = db.Column(db.String(120))  # Usuario/Responsable del activo
    color = db.Column(db.String(50))
    year_manufactured = db.Column(db.Integer)  # Año de manufactura
    brand = db.Column(db.String(120))  # Marca
    model = db.Column(db.String(120))  # Modelo

    # Campos específicos para vehículos
    chassis = db.Column(db.String(100))  # VIN o chassis number
    plate_number = db.Column(db.String(50))  # Número de placa

    # Campos específicos para equipos
    equipment_serial = db.Column(db.String(100))  # Serial del equipo
    equipment_supplier = db.Column(db.String(255))  # Suplidor del equipo

    # Campos de estado y ubicación
    physical_location = db.Column(db.String(255))  # Ubicación física actual
    asset_condition = db.Column(db.String(50), default='good')  # Estado: good, fair, poor, retired

    # Baja / retiro (Fase 2)
    disposal_date = db.Column(db.Date)
    disposal_amount = db.Column(db.Numeric(12, 2))       # valor recibido en la venta (0 si desecho)
    disposal_reason = db.Column(db.String(255))          # venta, desecho, pérdida, etc.
    disposal_gain_loss = db.Column(db.Numeric(12, 2))    # + ganancia / - pérdida

    # Conteo físico / verificación con QR (Fase 4)
    last_verified_at = db.Column(db.DateTime)
    last_verified_session_id = db.Column(db.Integer, db.ForeignKey('inventory_sessions.id'))

    # Auditoría
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    notes = db.Column(db.Text)

    # Relaciones
    depreciation_records = db.relationship('DepreciationRecord', backref='asset', lazy='dynamic', cascade='all, delete-orphan')

    def __init__(self, **kwargs):
        super(Asset, self).__init__(**kwargs)
        if not self.code:
            self.code = self.generate_code()

    def generate_code(self):
        """Generar código único para el activo"""
        timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
        random_part = str(uuid.uuid4().hex)[:6].upper()
        return f'ACT-{timestamp}-{random_part}'

    def get_residual_value(self):
        """Calcular valor residual absoluto"""
        return float(self.acquisition_cost) * (float(self.residual_value_percent) / 100)

    def get_depreciable_amount(self):
        """Monto a depreciar (Costo - Valor Residual)"""
        return float(self.acquisition_cost) - self.get_residual_value()

    def get_monthly_depreciation(self):
        """Depreciación mensual usando línea recta"""
        months = self.useful_life_years * 12
        return self.get_depreciable_amount() / months

    def get_accumulated_depreciation(self):
        """Depreciación acumulada hasta hoy"""
        records = DepreciationRecord.query.filter_by(asset_id=self.id).all()
        return sum(float(r.depreciation_amount) for r in records) if records else 0

    def get_net_book_value(self):
        """Valor neto en libros (Costo - Depreciación Acumulada)"""
        return float(self.acquisition_cost) - self.get_accumulated_depreciation()

    def is_fully_depreciated(self):
        """Verificar si el activo está completamente depreciado"""
        return self.get_accumulated_depreciation() >= self.get_depreciable_amount()

    def calculate_depreciation_for_month(self, year, month):
        """Calcular depreciación para un mes específico"""
        if self.is_fully_depreciated():
            return Decimal('0')

        depreciation = Decimal(str(self.get_monthly_depreciation()))
        accumulated = Decimal(str(self.get_accumulated_depreciation()))
        depreciable = Decimal(str(self.get_depreciable_amount()))

        # Si la suma excede el monto depreciable, ajustar
        if accumulated + depreciation > depreciable:
            depreciation = depreciable - accumulated

        return depreciation

    def __repr__(self):
        return f'<Asset {self.code} - {self.description}>'


class DepreciationRecord(db.Model):
    """Registro de Depreciación Mensual"""
    __tablename__ = 'depreciation_records'

    id = db.Column(db.Integer, primary_key=True)
    asset_id = db.Column(db.Integer, db.ForeignKey('assets.id'), nullable=False, index=True)
    year = db.Column(db.Integer, nullable=False)
    month = db.Column(db.Integer, nullable=False)  # 1-12
    depreciation_amount = db.Column(db.Numeric(12, 2), nullable=False)
    accumulated_depreciation = db.Column(db.Numeric(12, 2), nullable=False)
    net_book_value = db.Column(db.Numeric(12, 2), nullable=False)
    calculated_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    calculated_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    # Índice compuesto para evitar duplicados
    __table_args__ = (
        db.UniqueConstraint('asset_id', 'year', 'month', name='uq_asset_year_month'),
    )

    def get_display_month(self):
        """Retornar formato mes/año para visualización"""
        months = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
        return f"{months[self.month]}/{self.year}"

    def __repr__(self):
        return f'<DepreciationRecord {self.asset_id} - {self.year}-{self.month}>'


class AuditLog(db.Model):
    """Log de Auditoría"""
    __tablename__ = 'audit_logs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    entity_type = db.Column(db.String(50), nullable=False)  # 'Asset', 'Category', etc.
    entity_id = db.Column(db.Integer)
    action = db.Column(db.String(20), nullable=False)  # 'create', 'update', 'delete'
    old_value = db.Column(db.JSON)
    new_value = db.Column(db.JSON)
    description = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    ip_address = db.Column(db.String(50))

    def __repr__(self):
        return f'<AuditLog {self.entity_type} - {self.action}>'


class ChartOfAccounts(db.Model):
    """Catálogo de Cuentas Contables"""
    __tablename__ = 'chart_of_accounts'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(20), unique=True, nullable=False, index=True)
    name = db.Column(db.String(255), nullable=False)
    account_type = db.Column(db.String(50), nullable=False)  # 'Activo', 'Pasivo', 'Capital', 'Ingreso', 'Gasto'
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<ChartOfAccounts {self.code} - {self.name}>'


class JournalEntry(db.Model):
    """Asientos Contables"""
    __tablename__ = 'journal_entries'

    id = db.Column(db.Integer, primary_key=True)
    reference = db.Column(db.String(50), unique=True, nullable=True)
    entry_date = db.Column(db.Date, nullable=False, index=True)
    description = db.Column(db.String(255), nullable=False)
    debit_account_id = db.Column(db.Integer, db.ForeignKey('chart_of_accounts.id'))
    credit_account_id = db.Column(db.Integer, db.ForeignKey('chart_of_accounts.id'))
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    asset_id = db.Column(db.Integer, db.ForeignKey('assets.id'))
    year = db.Column(db.Integer, nullable=False, index=True)
    month = db.Column(db.Integer, nullable=False, index=True)
    entry_type = db.Column(db.String(50), default='general')  # general, depreciation, asset_purchase, disposal, revaluation, reversal
    status = db.Column(db.String(20), default='draft')  # 'draft', 'posted', 'cancelled', 'reversed'
    total_debit = db.Column(db.Numeric(12, 2), default=0)
    total_credit = db.Column(db.Numeric(12, 2), default=0)
    # Reverso de asientos (Fase 2)
    is_reversed = db.Column(db.Boolean, default=False)   # este asiento fue anulado
    reversal_of_id = db.Column(db.Integer)               # si este asiento ES el reverso de otro
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    debit_account = db.relationship('ChartOfAccounts', foreign_keys=[debit_account_id])
    credit_account = db.relationship('ChartOfAccounts', foreign_keys=[credit_account_id])
    lines = db.relationship('JournalEntryLine', backref='journal_entry', lazy='dynamic', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<JournalEntry {self.entry_date} - {self.amount}>'


class JournalEntryLine(db.Model):
    """Línea de Asiento Contable"""
    __tablename__ = 'journal_entry_lines'

    id = db.Column(db.Integer, primary_key=True)
    journal_entry_id = db.Column(db.Integer, db.ForeignKey('journal_entries.id'), nullable=False, index=True)
    account_code = db.Column(db.String(50), nullable=False)
    account_name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.String(255))
    debit_amount = db.Column(db.Numeric(12, 2), default=0)
    credit_amount = db.Column(db.Numeric(12, 2), default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<JournalEntryLine {self.account_code}>'


class CompanySettings(db.Model):
    """Datos de la empresa y parámetros del sistema (registro único)."""
    __tablename__ = 'company_settings'

    id = db.Column(db.Integer, primary_key=True)
    legal_name = db.Column(db.String(255))       # Razón social
    trade_name = db.Column(db.String(255))       # Nombre comercial
    rnc = db.Column(db.String(30))               # RNC
    address = db.Column(db.String(255))
    city = db.Column(db.String(120))
    phone = db.Column(db.String(50))
    email = db.Column(db.String(120))
    currency = db.Column(db.String(10), default='RD$')
    fiscal_year_start_month = db.Column(db.Integer, default=1)  # 1=Enero
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @staticmethod
    def get():
        """Obtener (o crear) el registro único de configuración."""
        s = CompanySettings.query.first()
        if not s:
            s = CompanySettings()
            db.session.add(s)
            db.session.commit()
        return s


class FiscalPeriodLock(db.Model):
    """Cierre de períodos contables: un período cerrado no acepta más posteos."""
    __tablename__ = 'fiscal_period_locks'

    id = db.Column(db.Integer, primary_key=True)
    year = db.Column(db.Integer, nullable=False)
    month = db.Column(db.Integer, nullable=False)
    is_closed = db.Column(db.Boolean, default=True)
    closed_at = db.Column(db.DateTime, default=datetime.utcnow)
    closed_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    __table_args__ = (
        db.UniqueConstraint('year', 'month', name='uq_period_lock'),
    )

    @staticmethod
    def is_period_closed(year, month):
        lock = FiscalPeriodLock.query.filter_by(year=year, month=month, is_closed=True).first()
        return lock is not None


class AssetMovement(db.Model):
    """Historial de movimientos del activo: alta, traslado, revaluación, baja."""
    __tablename__ = 'asset_movements'

    id = db.Column(db.Integer, primary_key=True)
    asset_id = db.Column(db.Integer, db.ForeignKey('assets.id'), nullable=False, index=True)
    movement_type = db.Column(db.String(30), nullable=False)  # acquisition, transfer, revaluation, retirement
    movement_date = db.Column(db.Date, nullable=False, default=datetime.utcnow)
    from_value = db.Column(db.String(255))   # texto: depto/ubicación/valor anterior
    to_value = db.Column(db.String(255))     # texto: depto/ubicación/valor nuevo
    amount = db.Column(db.Numeric(12, 2))    # monto asociado (revaluación, baja)
    journal_entry_id = db.Column(db.Integer, db.ForeignKey('journal_entries.id'))
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    asset = db.relationship('Asset', backref=db.backref('movements', lazy='dynamic'))


class InventorySession(db.Model):
    """Sesión de conteo físico (inventario) con escaneo de QR."""
    __tablename__ = 'inventory_sessions'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    status = db.Column(db.String(20), default='open')  # open | closed
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    started_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    closed_at = db.Column(db.DateTime)

    verified_assets = db.relationship('Asset', backref='inventory_session',
                                      foreign_keys='Asset.last_verified_session_id')
