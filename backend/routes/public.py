"""
Página pública del código QR de un activo.

SEGURIDAD — por qué existe este módulo:
Antes el QR apuntaba a "/?asset_id=N", es decir, a la aplicación completa. Si el
teléfono que escaneaba tenía una sesión abierta, el visitante quedaba dentro del
sistema con todos los permisos de ese usuario.

Ahora el QR apunta a "/activo/<id>", que sirve una ficha HTML independiente que
SOLO MUESTRA LA INFORMACIÓN DEL ACTIVO:
  · No carga la aplicación (ni su JavaScript, ni sus menús, ni la sesión).
  · No tiene ninguna acción ni enlace hacia el sistema: es puramente consulta.
  · No expone información financiera (costo, depreciación, valor en libros).
Quien escanee el QR ve la ficha y nada más, tenga o no sesión abierta.
"""
from flask import Blueprint, render_template_string, abort
from backend.models import Asset

public_bp = Blueprint('public', __name__)

CONDITION_LABELS = {'good': 'Bueno', 'fair': 'Regular', 'poor': 'Malo', 'retired': 'Retirado'}
STATUS_LABELS = {'active': 'Activo', 'inactive': 'Inactivo', 'retired': 'Dado de baja'}
STATUS_COLORS = {'active': '#166534', 'inactive': '#9a6a12', 'retired': '#991b1b'}
STATUS_BG = {'active': '#e8f3ec', 'inactive': '#fbf2df', 'retired': '#fbecea'}

_PAGE = """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>{{ a.code }} — Ficha del Activo</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; color: #1e293b;
         padding: 16px; line-height: 1.5; }
  .card { max-width: 560px; margin: 0 auto; background: white; border-radius: 12px;
          overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.1); }
  .head { background: linear-gradient(135deg, #003D7A 0%, #0051a8 100%); color: white; padding: 22px; }
  .head .code { font-size: 24px; font-weight: 700; letter-spacing: .5px; }
  .head .desc { font-size: 16px; opacity: .92; margin-top: 4px; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 14px; font-size: 13px;
           font-weight: 600; margin-top: 10px; }
  .sec { padding: 18px 22px; border-top: 1px solid #eef2f7; }
  .sec h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .06em;
            color: #64748b; margin-bottom: 12px; }
  .row { display: flex; justify-content: space-between; gap: 14px; padding: 7px 0; font-size: 15px; }
  .row .k { color: #64748b; flex-shrink: 0; }
  .row .v { font-weight: 600; text-align: right; word-break: break-word; }
  .foot { padding: 16px 22px; background: #f8fafc; font-size: 12px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
<div class="card">
  <div class="head">
    <div class="code">{{ a.code }}</div>
    <div class="desc">{{ a.description }}</div>
    <span class="badge" style="background:{{ bg }};color:{{ color }};">{{ status }}</span>
  </div>

  <div class="sec">
    <h3>Identificación</h3>
    <div class="row"><span class="k">Categoría</span><span class="v">{{ a.category.name if a.category else '—' }}</span></div>
    {% if a.brand or a.model %}<div class="row"><span class="k">Marca / Modelo</span><span class="v">{{ a.brand or '' }} {{ a.model or '' }}</span></div>{% endif %}
    {% if a.year_manufactured %}<div class="row"><span class="k">Año</span><span class="v">{{ a.year_manufactured }}</span></div>{% endif %}
    {% if a.color %}<div class="row"><span class="k">Color</span><span class="v">{{ a.color }}</span></div>{% endif %}
    {% if a.plate_number %}<div class="row"><span class="k">Placa</span><span class="v">{{ a.plate_number }}</span></div>{% endif %}
    {% if a.chassis %}<div class="row"><span class="k">Chasis / VIN</span><span class="v">{{ a.chassis }}</span></div>{% endif %}
    {% if a.serial_number %}<div class="row"><span class="k">Serie</span><span class="v">{{ a.serial_number }}</span></div>{% endif %}
  </div>

  <div class="sec">
    <h3>Ubicación y responsable</h3>
    <div class="row"><span class="k">Departamento</span><span class="v">{{ a.department_obj.name if a.department_obj else '—' }}</span></div>
    <div class="row"><span class="k">Localidad</span><span class="v">{{ a.location_obj.name if a.location_obj else '—' }}</span></div>
    {% if a.physical_location %}<div class="row"><span class="k">Ubicación física</span><span class="v">{{ a.physical_location }}</span></div>{% endif %}
    <div class="row"><span class="k">Usuario responsable</span><span class="v">{{ a.asset_user or '—' }}</span></div>
    <div class="row"><span class="k">Condición</span><span class="v">{{ condition }}</span></div>
    {% if a.acquisition_date %}<div class="row"><span class="k">Fecha de adquisición</span><span class="v">{{ a.acquisition_date.strftime('%d/%m/%Y') }}</span></div>{% endif %}
    {% if a.warranty %}<div class="row"><span class="k">Garantía</span><span class="v">{{ a.warranty }}</span></div>{% endif %}
  </div>

  <div class="foot">
    Ficha de consulta · Sistema de Activos Fijos
  </div>
</div>
</body>
</html>"""


@public_bp.route('/activo/<int:asset_id>')
def public_asset(asset_id):
    """Ficha pública de solo lectura a la que apunta el código QR."""
    asset = Asset.query.get(asset_id)
    if not asset:
        abort(404)
    return render_template_string(
        _PAGE,
        a=asset,
        status=STATUS_LABELS.get(asset.status, asset.status or '—'),
        color=STATUS_COLORS.get(asset.status, '#475569'),
        bg=STATUS_BG.get(asset.status, '#f1f5f9'),
        condition=CONDITION_LABELS.get(asset.asset_condition, asset.asset_condition or '—'),
    )
