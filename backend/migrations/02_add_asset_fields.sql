-- Agregar campos a asset_categories
ALTER TABLE asset_categories
ADD COLUMN IF NOT EXISTS asset_account VARCHAR(50),
ADD COLUMN IF NOT EXISTS asset_account_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS accumulated_depreciation_account VARCHAR(50),
ADD COLUMN IF NOT EXISTS depreciation_expense_account VARCHAR(50);

-- Agregar campos a assets
ALTER TABLE assets
ADD COLUMN IF NOT EXISTS brand VARCHAR(120),
ADD COLUMN IF NOT EXISTS color VARCHAR(100),
ADD COLUMN IF NOT EXISTS license_plate VARCHAR(50),
ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS fiscal_receipt_number VARCHAR(50);
