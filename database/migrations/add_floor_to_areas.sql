-- =====================================================
-- MIGRATION: Add Floor to Areas
-- =====================================================

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'areas' AND column_name = 'floor') THEN
        ALTER TABLE areas ADD COLUMN floor VARCHAR(50) DEFAULT 'Principal';
    END IF;
END $$;
