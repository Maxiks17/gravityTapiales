-- Crear tabla settings si no existe
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS para settings
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad para settings
CREATE POLICY "Users can view settings" ON settings
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update settings" ON settings
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert settings" ON settings
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Crear tabla para los cierres de caja
CREATE TABLE IF NOT EXISTS cash_register_closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    closure_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT,
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    order_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agregar índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_cash_register_closures_date ON cash_register_closures(closure_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_register_closures_user ON cash_register_closures(user_id);

-- Habilitar RLS
ALTER TABLE cash_register_closures ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Users can view all closures" ON cash_register_closures
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert closures" ON cash_register_closures
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Agregar configuración de última fecha de cierre en settings
INSERT INTO settings (key, value, description)
VALUES ('last_cash_closure_date', NOW()::TEXT, 'Fecha del último cierre de caja')
ON CONFLICT (key) DO NOTHING;

-- Comentarios para documentación
COMMENT ON TABLE cash_register_closures IS 'Registros de cierres de caja diarios';
COMMENT ON COLUMN cash_register_closures.closure_date IS 'Fecha y hora del cierre de caja';
COMMENT ON COLUMN cash_register_closures.user_id IS 'Usuario que realizó el cierre';
COMMENT ON COLUMN cash_register_closures.total_amount IS 'Importe total del cierre';
COMMENT ON COLUMN cash_register_closures.order_count IS 'Cantidad de órdenes en el período';
COMMENT ON COLUMN cash_register_closures.notes IS 'Notas u observaciones del cierre';
