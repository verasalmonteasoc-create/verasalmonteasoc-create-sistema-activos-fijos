#!/bin/bash

# Crear cuenta 1100 - Activos Fijos
curl -X POST http://localhost:5001/api/accounting/accounts \
  -H "Content-Type: application/json" \
  -d '{"code":"1100","name":"Activos Fijos","account_type":"Activo","description":"Cuenta para registrar activos fijos"}'

echo ""

# Crear cuenta 1900 - Depreciación Acumulada
curl -X POST http://localhost:5001/api/accounting/accounts \
  -H "Content-Type: application/json" \
  -d '{"code":"1900","name":"Depreciación Acumulada","account_type":"Activo","description":"Cuenta para registrar depreciación acumulada"}'

echo ""

# Crear cuenta 5100 - Gasto de Depreciación
curl -X POST http://localhost:5001/api/accounting/accounts \
  -H "Content-Type: application/json" \
  -d '{"code":"5100","name":"Gasto de Depreciación","account_type":"Gasto","description":"Cuenta para registrar gasto de depreciación"}'

echo ""
