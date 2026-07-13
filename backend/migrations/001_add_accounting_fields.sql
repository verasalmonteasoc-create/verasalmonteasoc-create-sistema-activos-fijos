-- Agregar campos contables a asset_categories
ALTER TABLE IF EXISTS asset_categories
ADD COLUMN IF NOT EXISTS asset_account VARCHAR(50),
ADD COLUMN IF NOT EXISTS asset_account_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS accumulated_depreciation_account VARCHAR(50),
ADD COLUMN IF NOT EXISTS depreciation_expense_account VARCHAR(50);

-- Agregar campos fiscales a assets
ALTER TABLE IF EXISTS assets
ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS fiscal_receipt_number VARCHAR(50);
