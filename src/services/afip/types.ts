/**
 * AFIP Types - TypeScript interfaces for AFIP integration
 * Ported from .NET projects: afip_login, afip_wsfev1, afip_factura
 */

// ─── Environment ────────────────────────────────────────────────────────────────

export type AfipEnvironment = 'production' | 'homologation';

// ─── AFIP settings stored in tenants.settings ────────────────────────────────────

export interface TenantAfipSettings {
  afip_status: boolean;
  afip_certificate_encrypted: string;
  afip_private_key_encrypted: string | null;
  afip_token: string | null;
  afip_sign: string | null;
  afip_expiration_token: string | null;
}

export interface CustomerAfipResponse {
  id: number;
  nombre: string;
  apellido: string;
  cuit: string;
  email: string;
  estado: boolean;
  tieneCertificado: boolean;
  fechaCreacion: string;
  fechaModificacion: string | null;
  tokenAfip: string;
  signAfip: string;
  fechaExpiracionToken: Date;
}

export interface CustomerCertificadoDto {
  cuit: string;
  certificadoPem: string;
  clavePrivadaPem: string;
}

export interface TokenInfo {
  token: string;
  sign: string;
  expirationTime: Date;
}

// ─── AFIP Auth (WSAA Login) ──────────────────────────────────────────────────────

export interface AfipLoginResult {
  token: string;
  sign: string;
  generationTime: Date;
  expirationTime: Date;
}

// ─── Invoice Request (from frontend) ─────────────────────────────────────────────

export interface FacturaRequest {
  /** 1 = Production, 2 = Homologation */
  ambiente: number;
  /** Taxpayer CUIT */
  cuit: number;
  /** Sales point number */
  puntoVenta: number;
  /** Voucher type (1=Factura A, 6=Factura B, 11=Factura C, etc.) */
  tipoComprobante: number;
  /** Concept (1=Products, 2=Services, 3=Both) */
  tipoConcepto: number;
  /** Client document type (80=CUIT, 96=DNI, etc.) */
  tipoDocCliente: number;
  /** Client document number */
  dniCliente: number;
  /** Total amount including all taxes */
  importeTotal: number;
  /** Net taxable amount */
  importeNeto: number;
  /** Total IVA amount */
  importeIVA: number;
  /** Currency code (PES, DOL, etc.) */
  moneda: string;
  /** Exchange rate (1 for ARS) */
  cotizacion: number;
  /** IVA rates breakdown */
  ivaList: AlicIvaDto[];
  /** Voucher date (ISO string) */
  fechaComprobante: string;
  // ── Credit note fields ──
  /** Original invoice number (for credit/debit notes) */
  numeroFactura?: number;
  /** Original invoice type (for credit/debit notes) */
  tipoFacturaOriginal?: number;
  /** Original sales point (for credit/debit notes) */
  puntoDeVentaOriginal?: number;
}

export interface AlicIvaDto {
  /**  IVA rate ID (3=0%, 4=10.5%, 5=21%, 6=27%) */
  id: number;
  /** Taxable base amount */
  baseImponible: number;
  /** IVA amount */
  importe: number;
}

export interface FacturaResponse {
  cae: string;
  caeFchVto: string;
  resultado: string;
  observacion: string;
  comprobanteNro?: string;
  comprobanteTipo?: number;
  comprobanteDescripcion?: string;
}

// ─── WSFEv1 Internal Types ───────────────────────────────────────────────────────

export interface FEAuthRequest {
  token: string;
  sign: string;
  cuit: number;
}

export interface FECAERequest {
  feCabReq: FECabRequest;
  feDetReq: FECAEDetRequest[];
}

export interface FECabRequest {
  cantReg: number;
  ptoVta: number;
  cbteTipo: number;
}

export interface FECAEDetRequest {
  concepto: number;
  docTipo: number;
  docNro: number;
  cbteDesde: number;
  cbteHasta: number;
  cbteFch: string;
  impTotal: number;
  impNeto: number;
  impIVA: number;
  impOpEx: number;
  impTotConc: number;
  impTrib: number;
  monId: string;
  monCotiz: number;
  condicionIVAReceptorId: number;
  fchServDesde?: string;
  fchServHasta?: string;
  fchVtoPago?: string;
  iva: AlicIva[] | null;
  tributos?: Tributo[];
  cbtesAsoc?: CbteAsoc[];
  opcionales?: Opcional[];
}

export interface AlicIva {
  id: number;
  baseImp: number;
  importe: number;
}

export interface Tributo {
  id: number;
  desc: string;
  baseImp: number;
  alic: number;
  importe: number;
}

export interface CbteAsoc {
  tipo: number;
  ptoVta: number;
  nro: number;
  cuit?: string;
  cbteFch?: string;
}

export interface Opcional {
  id: string;
  valor: string;
}

// ─── WSFEv1 Response Types ───────────────────────────────────────────────────────

export interface FECAEResponse {
  feCabResp: FECabResponse;
  feDetResp: FECAEDetResponse[];
  errors?: AfipError[];
  events?: AfipEvent[];
}

export interface FECabResponse {
  cuit: number;
  ptoVta: number;
  cbteTipo: number;
  fchProceso: string;
  cantReg: number;
  resultado: string;
  reproceso: string;
}

export interface FECAEDetResponse {
  concepto: number;
  docTipo: number;
  docNro: number;
  cbteDesde: number;
  cbteHasta: number;
  cbteFch: string;
  resultado: string;
  cae: string;
  caeFchVto: string;
  observaciones?: AfipObservacion[];
}

export interface AfipError {
  code: number;
  msg: string;
}

export interface AfipEvent {
  code: number;
  msg: string;
}

export interface AfipObservacion {
  code: number;
  msg: string;
}

export interface FERecuperaLastCbteResponse {
  ptoVta: number;
  cbteTipo: number;
  cbteNro: number;
  errors?: AfipError[];
}

export interface CbteTipoItem {
  id: number;
  desc: string;
  fchDesde: string;
  fchHasta: string;
}

// ─── Customer Create/Update DTOs ─────────────────────────────────────────────────

export interface CustomerCreateDto {
  nombre: string;
  apellido: string;
  cuit: string;
  email: string;
  estado?: boolean;
  certificadoPem: string;
  clavePrivadaPem: string;
}

export interface CustomerUpdateDto {
  nombre: string;
  apellido: string;
  email: string;
  estado: boolean;
  certificadoPem?: string;
  clavePrivadaPem?: string;
}
