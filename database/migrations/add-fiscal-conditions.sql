-- =====================================================
-- MIGRATION: Add Fiscal Conditions and link to customers
-- =====================================================

-- 1. Create fiscal_condition table (translated from "condicion_fiscal")
CREATE TABLE IF NOT EXISTS fiscal_condition (
    -- Use AFIP code as the primary key (so customers.condicion_fiscal_id can store 0/AFIP code directly)
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    id_afip INTEGER,
    comp_Clase VARCHAR(30)
);

-- Keep AFIP IDs unique (idempotent seed)
CREATE UNIQUE INDEX IF NOT EXISTS uq_fiscal_condition_id_afip ON fiscal_condition(id_afip);

-- 2. Enable RLS
ALTER TABLE fiscal_condition ENABLE ROW LEVEL SECURITY;

-- 3. Policies (global reference table)
DROP POLICY IF EXISTS "Enable read access for all users" ON fiscal_condition;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON fiscal_condition;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON fiscal_condition;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON fiscal_condition;

CREATE POLICY "Enable read access for all users" ON fiscal_condition
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON fiscal_condition
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON fiscal_condition
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON fiscal_condition
    FOR DELETE USING (auth.role() = 'authenticated');

-- 4. Seed default fiscal conditions (AFIP)
INSERT INTO fiscal_condition (id, name, id_afip, comp_Clase) VALUES
    (0,  'Sin especificar', 0, ''),
    (1,  'IVA Responsable Inscripto', 1, 'A/ALEY/C'),
    (6,  'Responsable Monotributo', 6, 'A/ALEY/C'),
    (13, 'Monotributista Social', 13, 'A/ALEY/C'),
    (16, 'Monotributo Trabajador Independiente Promovido', 16, 'A/ALEY/C'),
    (4,  'IVA Sujeto Exento', 4, 'B/C'),
    (7,  'Sujeto No Categorizado', 7, 'B/C'),
    (8,  'Proveedor del Exterior', 8, 'B/C'),
    (9,  'Cliente del Exterior', 9, 'B/C'),
    (10, 'IVA Liberado – Ley N° 19.640', 10, ''),
    (15, 'IVA No Alcanzado', 15, 'B/C'),
    (5,  'Consumidor Final', 5, 'C/49')
ON CONFLICT (id) DO NOTHING;

-- 5.  Add condicion_fiscal_id to customers + FK 
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS condicion_fiscal_id INTEGER DEFAULT 0 REFERENCES fiscal_condition(id);
