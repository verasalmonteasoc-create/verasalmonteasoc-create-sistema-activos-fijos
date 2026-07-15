#!/usr/bin/env python
import sys
sys.path.insert(0, r'C:\Users\Edwin\Claude\Activos  Fijos')

from backend.app import app, db
from backend.models import Location

with app.app_context():
    # Crear tabla de localidades
    db.create_all()
    print("✓ Tablas creadas/verificadas")

    # Crear localidades de ejemplo si no existen
    if Location.query.count() == 0:
        locations = [
            Location(name="Matriz - Santo Domingo", address="Calle Principal 123", city="Santo Domingo", phone="+1-809-123-4567", description="Oficina principal"),
            Location(name="Santiago", address="Calle Duarte 456", city="Santiago", phone="+1-809-234-5678", description="Sucursal Santiago"),
            Location(name="La Romana", address="Calle Central 789", city="La Romana", phone="+1-809-345-6789", description="Sucursal La Romana"),
        ]
        for loc in locations:
            db.session.add(loc)
        db.session.commit()
        print("✓ Localidades de ejemplo creadas")
    else:
        print(f"✓ Ya existen {Location.query.count()} localidades")
