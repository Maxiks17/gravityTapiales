-- =====================================================
-- MIGRATION: Master Areas Hierarchy
-- =====================================================

-- 1. Add recursion and positioning columns to areas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'areas' AND column_name = 'parent_id') THEN
        ALTER TABLE areas ADD COLUMN parent_id UUID REFERENCES areas(id) ON DELETE CASCADE;
        CREATE INDEX idx_areas_parent_id ON areas(parent_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'areas' AND column_name = 'position_x') THEN
        ALTER TABLE areas ADD COLUMN position_x INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'areas' AND column_name = 'position_y') THEN
        ALTER TABLE areas ADD COLUMN position_y INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'areas' AND column_name = 'width') THEN
        ALTER TABLE areas ADD COLUMN width INTEGER DEFAULT 6;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'areas' AND column_name = 'height') THEN
        ALTER TABLE areas ADD COLUMN height INTEGER DEFAULT 5;
    END IF;
END $$;

-- 2. Convert 'floor' text groups into actual Master Areas
-- Look for areas that have a floor defined but no parent, and migrate them.
DO $$
DECLARE
    r RECORD;
    new_parent_id UUID;
    pos_x INTEGER;
    pos_y INTEGER;
BEGIN
    -- Iterate over distinct floors from areas that don't have a parent yet
    -- and where floor is not null (assuming 'Principal' might be default)
    FOR r IN SELECT DISTINCT floor, tenant_id FROM areas WHERE parent_id IS NULL AND floor IS NOT NULL AND floor != '' LOOP
        
        -- Check if a Master Area with this name already exists for this tenant
        SELECT id INTO new_parent_id FROM areas WHERE name = r.floor AND tenant_id = r.tenant_id AND parent_id IS NULL;
        
        -- If not, create it
        IF new_parent_id IS NULL THEN
            INSERT INTO areas (tenant_id, name, is_active, sort_order)
            VALUES (r.tenant_id, r.floor, true, 0)
            RETURNING id INTO new_parent_id;
        END IF;

        -- Update children
        -- Assign simple grid positions to children to avoid overlap initially
        pos_x := 0;
        pos_y := 0;
        
        -- Update all areas with this floor to be children of the new Master Area
        UPDATE areas 
        SET parent_id = new_parent_id,
            -- Simple logic to space them out: increment X, wrap every 3 items (assuming grid width ~20-25). Space by 7 to leave gap.
            position_x = ((row_number_val - 1) % 3) * 7, 
            position_y = ((row_number_val - 1) / 3) * 6
        FROM (
            SELECT id, row_number() OVER (ORDER BY name) as row_number_val 
            FROM areas 
            WHERE floor = r.floor AND tenant_id = r.tenant_id AND id != new_parent_id
        ) as sub
        WHERE areas.id = sub.id;

    END LOOP;
END $$;
