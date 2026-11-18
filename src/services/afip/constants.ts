/**
 * AFIP Constants - Voucher types, document types, IVA rates, endpoints
 * Ported from afip_wsfev1/Factura.cs and afip_factura configuration
 */

// ─── AFIP Endpoints ──────────────────────────────────────────────────────────────

export const AFIP_ENDPOINTS = {
  wsaa: {
    homologation: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
    production: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
  },
  wsfev1: {
    homologation: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
    production: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
  },
} as const;

// ─── SOAP Namespaces ─────────────────────────────────────────────────────────────

export const SOAP_NS = {
  soap11: 'http://schemas.xmlsoap.org/soap/envelope/',
  wsaa: 'http://wsaa.view.sua.dvadac.desein.afip.gov',
  wsfev1: 'http://ar.gov.afip.dif.FEV1/',
} as const;

// ─── Voucher Types (TipoComprobante) ─────────────────────────────────────────────

export const TipoComprobante = {
  FacturaA: 1,
  NotaDebitoA: 2,
  NotaCreditoA: 3,
  FacturaB: 6,
  NotaDebitoB: 7,
  NotaCreditoB: 8,
  FacturaC: 11,
  NotaDebitoC: 12,
  NotaCreditoC: 13,
  FacturaE: 19,
  NotaDebitoE: 20,
  NotaCreditoE: 21,
} as const;

// ─── Document Types (TipoDocumento) ──────────────────────────────────────────────

export const TipoDocumento = {
  CUIT: 80,
  CUIL: 86,
  CDI: 87,
  LE: 89,
  LC: 90,
  CI_Extranjera: 91,
  EnTramite: 92,
  Acta_Nacimiento: 93,
  CI_Bs_As_RNP: 95,
  DNI: 96,
  Pasaporte: 94,
  CI_Policia_Federal: 0,
  SinIdentificar_Exterior: 99,
} as const;

// ─── Concept Types (TipoConcepto) ────────────────────────────────────────────────

export const TipoConcepto = {
  Productos: 1,
  Servicios: 2,
  ProductosYServicios: 3,
} as const;

// ─── IVA Rate Types (TipoIVA) ────────────────────────────────────────────────────

export const TipoIVA = {
  NoGravado: 1,
  Exento: 2,
  Cero: 3,
  DiezYMedio: 4,   // 10.5%
  Veintiuno: 5,    // 21%
  Veintisiete: 6,  // 27%
  Cinco: 8,        // 5%
  DosYMedio: 9,    // 2.5%
} as const;

// ─── IVA Condition (CondicionIVA) ────────────────────────────────────────────────

export const CondicionIVA = {
  ResponsableInscripto: 1,
  ResponsableNoInscripto: 2,
  NoResponsable: 3,
  Exento: 4,
  ConsumidorFinal: 5,
  ResponsableMonotributo: 6,
  SujetoNoCategorizado: 7,
  ProveedorExterior: 8,
  ClienteExterior: 9,
  IVALiberado: 10,
  ResponsableInscriptoAgente: 11,
  PequenoContribuyenteEventual: 12,
  MonotributistaSocial: 13,
  PequenoContribuyenteEventualSocial: 14,
} as const;
