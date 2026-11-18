-- =====================================================
-- MIGRATION: Areas and Visual Layout
-- =====================================================

-- 1. Create Areas table
CREATE TABLE IF NOT EXISTS areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for tenant_id
CREATE INDEX IF NOT EXISTS idx_areas_tenant_id ON areas(tenant_id);

-- RLS Policies for Areas
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "areas_select_policy" ON areas;
CREATE POLICY "areas_select_policy" ON areas FOR SELECT
    USING (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid() AND is_active = true));

DROP POLICY IF EXISTS "areas_insert_policy" ON areas;
CREATE POLICY "areas_insert_policy" ON areas FOR INSERT
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid() AND is_active = true));

DROP POLICY IF EXISTS "areas_update_policy" ON areas;
CREATE POLICY "areas_update_policy" ON areas FOR UPDATE
    USING (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid() AND is_active = true));

DROP POLICY IF EXISTS "areas_delete_policy" ON areas;
CREATE POLICY "areas_delete_policy" ON areas FOR DELETE
    USING (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid() AND is_active = true));

-- Trigger for Areas updated_at
DROP TRIGGER IF EXISTS areas_updated_at ON areas;
CREATE TRIGGER areas_updated_at BEFORE UPDATE ON areas
    FOR EACH ROW EXECUTE FUNCTION update_tables_updated_at(); -- Note: reusing existing function name if available, or create generic one

-- Trigger for auto-setting tenant_id
DROP TRIGGER IF EXISTS set_tenant_id_areas ON areas;
CREATE TRIGGER set_tenant_id_areas BEFORE INSERT ON areas
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id();

-- 2. Update Tables table
DO $$ 
BEGIN
    -- Add area_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tables' AND column_name = 'area_id') THEN
        ALTER TABLE tables ADD COLUMN area_id UUID REFERENCES areas(id) ON DELETE SET NULL;
    END IF;

    -- Add visual properties
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tables' AND column_name = 'shape') THEN
        ALTER TABLE tables ADD COLUMN shape VARCHAR(20) DEFAULT 'rectangle'; -- rectangle, round, square
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tables' AND column_name = 'width') THEN
        ALTER TABLE tables ADD COLUMN width INTEGER DEFAULT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tables' AND column_name = 'height') THEN
        ALTER TABLE tables ADD COLUMN height INTEGER DEFAULT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tables' AND column_name = 'rotation') THEN
        ALTER TABLE tables ADD COLUMN rotation INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add index for area_id
CREATE INDEX IF NOT EXISTS idx_tables_area_id ON tables(area_id);
