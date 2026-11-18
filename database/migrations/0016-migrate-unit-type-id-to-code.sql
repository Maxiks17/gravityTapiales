-- Migración: reemplaza unit_type_id (UUID FK) por unit_type_code (VARCHAR) en stocks
-- y elimina la tabla unit_types que pasa a ser una constante en el código.

-- 1. Agregar columna nueva
ALTER TABLE stocks ADD COLUMN unit_type_code VARCHAR(10);

-- 2. Poblar desde join con unit_types (datos existentes)
UPDATE stocks s
SET unit_type_code = ut.code
FROM unit_types ut
WHERE s.unit_type_id = ut.id;

-- 3. Default 'unit' para stocks sin unit_type asignado
UPDATE stocks SET unit_type_code = 'unit' WHERE unit_type_code IS NULL;

-- 4. Eliminar FK y columna vieja
ALTER TABLE stocks DROP COLUMN unit_type_id;

-- 5. Eliminar tabla unit_types (ya sin referencias)
DROP TABLE IF EXISTS unit_types;
