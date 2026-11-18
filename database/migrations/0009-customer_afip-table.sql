-- Migration: Add token, sign and expiration date columns to customers_afip table
-- This migration adds three new columns to store AFIP authentication data:
-- 1. token - stores the AFIP authentication token (XML base64 encoded)
-- 2. sign - stores the cryptographic signature for the token
-- 3. expiracion_Token - stores the expiration date/time of the token

-- Add the token column to store AFIP authentication token
ALTER TABLE customers_afip 
ADD COLUMN token TEXT;

-- Add the sign column to store the cryptographic signature
ALTER TABLE customers_afip 
ADD COLUMN sign TEXT;

-- Add the expiration date column for the token
ALTER TABLE customers_afip 
ADD COLUMN expiracion_Token timestamptz;

-- Add comments to document the purpose of these columns
COMMENT ON COLUMN customers_afip.token IS 'AFIP authentication token (base64 encoded XML)';
COMMENT ON COLUMN customers_afip.sign IS 'Cryptographic signature for the AFIP authentication token';
COMMENT ON COLUMN customers_afip.expiracion_Token IS 'Expiration date and time of the AFIP authentication token';