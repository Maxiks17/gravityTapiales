-- Migration: Rename fiscal_documents columns from invoice_* to fdoc_*
-- This migration updates column names to match the table name (fiscal_documents)
-- Date: December 2024

-- Step 1: Rename columns
ALTER TABLE fiscal_documents RENAME COLUMN invoice_number TO fdoc_number;
ALTER TABLE fiscal_documents RENAME COLUMN invoice_date TO fdoc_date;

-- Step 2: Rename constraints (drop and recreate with new names)
-- Primary key
ALTER TABLE fiscal_documents DROP CONSTRAINT IF EXISTS invoices_pkey;
ALTER TABLE fiscal_documents ADD CONSTRAINT fiscal_documents_pkey PRIMARY KEY (id);

-- Unique constraint on fdoc_number
ALTER TABLE fiscal_documents DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;
ALTER TABLE fiscal_documents ADD CONSTRAINT fiscal_documents_fdoc_number_key UNIQUE (fdoc_number);

-- Foreign keys
ALTER TABLE fiscal_documents DROP CONSTRAINT IF EXISTS invoices_customer_id_fkey;
ALTER TABLE fiscal_documents ADD CONSTRAINT fiscal_documents_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT;

ALTER TABLE fiscal_documents DROP CONSTRAINT IF EXISTS invoices_order_id_fkey;
ALTER TABLE fiscal_documents ADD CONSTRAINT fiscal_documents_order_id_fkey 
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

ALTER TABLE fiscal_documents DROP CONSTRAINT IF EXISTS invoices_tenant_id_fkey;
ALTER TABLE fiscal_documents ADD CONSTRAINT fiscal_documents_tenant_id_fkey 
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Step 3: Rename indexes
DROP INDEX IF EXISTS idx_invoices_status;
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_status ON fiscal_documents(status);

DROP INDEX IF EXISTS idx_invoices_date;
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_fdoc_date ON fiscal_documents(fdoc_date);

DROP INDEX IF EXISTS idx_invoices_order_id;
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_order_id ON fiscal_documents(order_id);

DROP INDEX IF EXISTS idx_invoices_customer_id;
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_customer_id ON fiscal_documents(customer_id);

-- Step 4: Rename triggers
DROP TRIGGER IF EXISTS set_tenant_id_invoices ON fiscal_documents;
CREATE TRIGGER set_tenant_id_fiscal_documents 
    BEFORE INSERT ON fiscal_documents 
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON fiscal_documents;
CREATE TRIGGER update_fiscal_documents_updated_at 
    BEFORE UPDATE ON fiscal_documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 5: Update comments
COMMENT ON TABLE fiscal_documents IS 'Fiscal documents (invoices, credit notes, debit notes, etc.) for AFIP';
COMMENT ON COLUMN fiscal_documents.fdoc_number IS 'Unique fiscal document number';
COMMENT ON COLUMN fiscal_documents.fdoc_date IS 'Date when the fiscal document was issued';

-- Verification queries (run manually to check):
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'fiscal_documents' ORDER BY ordinal_position;
-- SELECT conname FROM pg_constraint WHERE conrelid = 'fiscal_documents'::regclass;
-- SELECT indexname FROM pg_indexes WHERE tablename = 'fiscal_documents';
