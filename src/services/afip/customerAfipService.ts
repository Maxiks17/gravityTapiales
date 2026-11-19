/**
 * Customer AFIP Service - CRUD operations on customers_afip table via Supabase
 * Ported from afip_factura/Application/ClienteService.cs
 *
 * Manages:
 * - Customer CRUD (nombre, apellido, cuit, email)
 * - Encrypted certificate storage in tenants.settings
 * - Token management in tenants.settings
 * - Certificate decryption for AFIP authentication
 *
 * NOTE: estado, certificado_encriptado, certificado_private_key_encriptada,
 * token, sign and expiration_token are stored in tenants.settings (JSONB),
 * not in the customers_afip table.
 */

import { supabase } from '../supabaseClient';
import { EncryptionService } from '../encryptionService';
// Local row type matching the customers_afip table after migration
type CustomerAfipRow = {
  id: number;
  nombre: string;
  apellido: string;
  cuit: string;
  email: string;
  fecha_creacion: string;
  fecha_modificacion: string | null;
  tenant_id: string;
};

import type {
  TenantAfipSettings,
  CustomerAfipResponse,
  CustomerCertificadoDto,
  TokenInfo,
  CustomerCreateDto,
  CustomerUpdateDto,
} from './types';

// ─── Encryption Key ──────────────────────────────────────────────────────────────

const ENCRYPTION_KEY = import.meta.env.ENCRYPTION_KEY || '';

function getEncryptionService(): EncryptionService {
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY not configured');
  }
  return new EncryptionService(ENCRYPTION_KEY);
}

// ─── Tenant settings helpers ──────────────────────────────────────────────────────

async function getTenantAfipSettings(tenantId: string): Promise<TenantAfipSettings | null> {
  const { data, error } = await supabase
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .single();

  if (error || !data) return null;
  return (data.settings ?? {}) as TenantAfipSettings;
}

async function updateTenantAfipSettings(
  tenantId: string,
  patch: Partial<TenantAfipSettings>
): Promise<boolean> {
  const { data: current, error: readError } = await supabase
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .single();

  if (readError) return false;

  const merged = { ...(current?.settings ?? {}), ...patch };
  const { error } = await supabase
    .from('tenants')
    .update({ settings: merged })
    .eq('id', tenantId);

  return !error;
}

// ─── Mappers ─────────────────────────────────────────────────────────────────────

function mapToResponse(c: CustomerAfipRow, settings: TenantAfipSettings | null): CustomerAfipResponse {
  return {
    id: c.id,
    nombre: c.nombre,
    apellido: c.apellido,
    cuit: c.cuit,
    email: c.email,
    estado: settings?.afip_status ?? false,
    tieneCertificado: !!settings?.afip_certificate_encrypted,
    fechaCreacion: c.fecha_creacion,
    fechaModificacion: c.fecha_modificacion,
    tokenAfip: settings?.afip_token || '',
    signAfip: settings?.afip_sign || '',
    fechaExpiracionToken: settings?.afip_expiration_token
      ? new Date(settings.afip_expiration_token)
      : new Date(0),
  };
}

// ─── Read Operations ─────────────────────────────────────────────────────────────

/**
 * Get all customers (with AFIP settings from tenant)
 */
export async function obtenerTodos(): Promise<CustomerAfipResponse[]> {
  const { data, error } = await supabase
    .from('customers_afip')
    .select('*, tenant:tenants(settings)')
    .order('apellido', { ascending: true })
    .order('nombre', { ascending: true });

  if (error) throw new Error(`Error fetching customers: ${error.message}`);

  return (data as (CustomerAfipRow & { tenant: { settings: TenantAfipSettings } | null })[]).map(
    row => mapToResponse(row, row.tenant?.settings ?? null)
  );
}

/**
 * Get customer by ID
 */
export async function obtenerPorId(id: number): Promise<CustomerAfipResponse | null> {
  const { data, error } = await supabase
    .from('customers_afip')
    .select('*, tenant:tenants(settings)')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Error fetching customer: ${error.message}`);
  }

  if (!data) return null;
  const row = data as CustomerAfipRow & { tenant: { settings: TenantAfipSettings } | null };
  return mapToResponse(row, row.tenant?.settings ?? null);
}

/**
 * Get customer by CUIT
 */
export async function obtenerPorCuit(cuit: string): Promise<CustomerAfipResponse | null> {
  const { data, error } = await supabase
    .from('customers_afip')
    .select('*, tenant:tenants(settings)')
    .eq('cuit', cuit)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Error fetching customer by CUIT: ${error.message}`);
  }

  if (!data) return null;
  const row = data as CustomerAfipRow & { tenant: { settings: TenantAfipSettings } | null };
  return mapToResponse(row, row.tenant?.settings ?? null);
}

/**
 * Check if a customer exists and is enabled (afip_status = true in tenant settings)
 */
export async function existeClienteHabilitado(cuit: string): Promise<CustomerAfipResponse | null> {
  console.log(`[CustomerAfipService] Checking enabled customer for CUIT: ${cuit}`);

  const { data, error } = await supabase
    .from('customers_afip')
    .select('*, tenant:tenants(settings)')
    .eq('cuit', cuit)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Error checking customer: ${error.message}`);
  }

  if (!data) return null;

  const row = data as CustomerAfipRow & { tenant: { settings: TenantAfipSettings } | null };
  const settings = row.tenant?.settings ?? null;

  if (!settings?.afip_status) return null;

  return mapToResponse(row, settings);
}

// ─── Certificate Operations ──────────────────────────────────────────────────────

/**
 * Get the decrypted certificate for a customer
 * Equivalent to ClienteService.ObtenerCertificadoDesencriptadoAsync in .NET
 */
export async function obtenerCertificadoDesencriptado(cuit: string): Promise<CustomerCertificadoDto | null> {
  const { data, error } = await supabase
    .from('customers_afip')
    .select('cuit, tenant_id, tenant:tenants(settings)')
    .eq('cuit', cuit)
    .single();

  if (error || !data) return null;

  const row = data as unknown as Pick<CustomerAfipRow, 'cuit' | 'tenant_id'> & {
    tenant: { settings: TenantAfipSettings } | null;
  };
  const settings = row.tenant?.settings;

  if (!settings?.afip_status) return null;

  if (!settings.afip_certificate_encrypted || !settings.afip_private_key_encrypted) {
    console.error(`Customer ${cuit} does not have a certificate configured`);
    return null;
  }

  try {
    const enc = getEncryptionService();
    const certificadoPem = await enc.decryptString(settings.afip_certificate_encrypted);
    const clavePrivadaPem = await enc.decryptString(settings.afip_private_key_encrypted);

    return {
      cuit: row.cuit,
      certificadoPem,
      clavePrivadaPem,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Error decrypting certificate for CUIT ${cuit}: ${msg}`);
  }
}

// ─── Token Operations ────────────────────────────────────────────────────────────

/**
 * Get token info for a customer (reads from tenants.settings)
 */
export async function obtenerToken(cuit: string): Promise<TokenInfo | null> {
  const { data, error } = await supabase
    .from('customers_afip')
    .select('tenant_id, tenant:tenants(settings)')
    .eq('cuit', cuit)
    .single();

  if (error || !data) return null;

  const row = data as unknown as Pick<CustomerAfipRow, 'tenant_id'> & {
    tenant: { settings: TenantAfipSettings } | null;
  };
  const settings = row.tenant?.settings;

  if (!settings?.afip_status || !settings.afip_token || !settings.afip_sign) return null;

  return {
    token: settings.afip_token,
    sign: settings.afip_sign,
    expirationTime: settings.afip_expiration_token
      ? new Date(settings.afip_expiration_token)
      : new Date(0),
  };
}

/**
 * Update AFIP token, sign and expiration in tenants.settings
 * Equivalent to ClienteService.ActualizarTokenAsync in .NET
 */
export async function actualizarToken(
  cuit: string,
  token: string,
  sign: string,
  fechaExpiracion: Date
): Promise<boolean> {
  const { data, error: lookupError } = await supabase
    .from('customers_afip')
    .select('tenant_id')
    .eq('cuit', cuit)
    .single();

  if (lookupError || !data) {
    console.error(`Error looking up tenant for CUIT ${cuit}:`, lookupError?.message);
    return false;
  }

  const { tenant_id } = data as Pick<CustomerAfipRow, 'tenant_id'>;
  const ok = await updateTenantAfipSettings(tenant_id, {
    afip_token: token,
    afip_sign: sign,
    afip_expiration_token: fechaExpiracion.toISOString(),
  });

  if (!ok) {
    console.error(`Error updating token for CUIT ${cuit}`);
    return false;
  }

  // Also touch fecha_modificacion on the customers_afip row
  await supabase
    .from('customers_afip')
    .update({ fecha_modificacion: new Date().toISOString() })
    .eq('cuit', cuit);

  console.log(`Token updated for CUIT ${cuit}, expires: ${fechaExpiracion.toISOString()}`);
  return true;
}

// ─── CRUD Operations ─────────────────────────────────────────────────────────────

/**
 * Create a new customer.
 * Saves cert and estado in tenants.settings; only basic fields go into customers_afip.
 */
export async function crearCliente(dto: CustomerCreateDto): Promise<CustomerAfipResponse> {
  const existingCuit = await obtenerPorCuit(dto.cuit);
  if (existingCuit) throw new Error(`Ya existe un cliente con el CUIT ${dto.cuit}`);

  const enc = getEncryptionService();
  const certificadoEncriptado = await enc.encryptString(dto.certificadoPem);
  const clavePrivadaEncriptada = await enc.encryptString(dto.clavePrivadaPem);

  const { data, error } = await supabase
    .from('customers_afip')
    .insert({
      nombre: dto.nombre,
      apellido: dto.apellido,
      cuit: dto.cuit,
      email: dto.email,
      fecha_creacion: new Date().toISOString(),
    })
    .select('*, tenant:tenants(settings)')
    .single();

  if (error) throw new Error(`Error creating customer: ${error.message}`);

  const row = data as CustomerAfipRow & { tenant: { settings: TenantAfipSettings } | null };

  await updateTenantAfipSettings(row.tenant_id, {
    afip_status: dto.estado ?? true,
    afip_certificate_encrypted: certificadoEncriptado,
    afip_private_key_encrypted: clavePrivadaEncriptada,
  });

  const settings = await getTenantAfipSettings(row.tenant_id);
  return mapToResponse(row, settings);
}

/**
 * Update an existing customer.
 * Updates basic fields in customers_afip; cert and estado go to tenants.settings.
 */
export async function actualizarCliente(id: number, dto: CustomerUpdateDto): Promise<CustomerAfipResponse | null> {
  const { data, error } = await supabase
    .from('customers_afip')
    .update({
      nombre: dto.nombre,
      apellido: dto.apellido,
      email: dto.email,
      fecha_modificacion: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, tenant:tenants(settings)')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Error updating customer: ${error.message}`);
  }
  if (!data) return null;

  const row = data as CustomerAfipRow & { tenant: { settings: TenantAfipSettings } | null };
  const settingsPatch: Partial<TenantAfipSettings> = { afip_status: dto.estado };

  if (dto.certificadoPem && dto.clavePrivadaPem) {
    const enc = getEncryptionService();
    settingsPatch.afip_certificate_encrypted = await enc.encryptString(dto.certificadoPem);
    settingsPatch.afip_private_key_encrypted = await enc.encryptString(dto.clavePrivadaPem);
  }

  await updateTenantAfipSettings(row.tenant_id, settingsPatch);

  const settings = await getTenantAfipSettings(row.tenant_id);
  return mapToResponse(row, settings);
}

/**
 * Delete a customer
 */
export async function eliminarCliente(id: number): Promise<boolean> {
  const { error } = await supabase
    .from('customers_afip')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(`Error deleting customer ${id}:`, error.message);
    return false;
  }
  return true;
}

/**
 * Toggle customer state (enable/disable) — updates tenants.settings.afip_status
 */
export async function cambiarEstado(id: number, nuevoEstado: boolean): Promise<boolean> {
  const { data, error: lookupError } = await supabase
    .from('customers_afip')
    .select('tenant_id')
    .eq('id', id)
    .single();

  if (lookupError || !data) {
    console.error(`Error looking up tenant for customer ${id}:`, lookupError?.message);
    return false;
  }

  const { tenant_id } = data as Pick<CustomerAfipRow, 'tenant_id'>;
  const ok = await updateTenantAfipSettings(tenant_id, { afip_status: nuevoEstado });

  if (!ok) {
    console.error(`Error changing state for customer ${id}`);
    return false;
  }

  await supabase
    .from('customers_afip')
    .update({ fecha_modificacion: new Date().toISOString() })
    .eq('id', id);

  return true;
}
