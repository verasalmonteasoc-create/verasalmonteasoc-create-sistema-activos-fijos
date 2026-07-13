-- Agregar campos contables a asset_categories si no existen
ALTER TABLE asset_categories
ADD COLUMN IF NOT EXISTS asset_account VARCHAR(50),
ADD COLUMN IF NOT EXISTS asset_account_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS accumulated_depreciation_account VARCHAR(50),
ADD COLUMN IF NOT EXISTS depreciation_expense_account VARCHAR(50);

-- Agregar campos fiscales a assets si no existen
ALTER TABLE assets
ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS fiscal_receipt_number VARCHAR(50);
