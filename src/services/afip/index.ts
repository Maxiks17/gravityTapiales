/**
 * AFIP Module - Barrel exports
 * 
 * This module provides a complete TypeScript port of three .NET 6 projects:
 * - afip_login  → afipAuth.ts (WSAA authentication with CMS/PKCS#7 signing)
 * - afip_wsfev1 → afipWsfev1.ts (WSFEv1 SOAP electronic invoicing operations)
 * - afip_factura → facturacionService.ts + customerAfipService.ts (API orchestration)
 *
 * Architecture:
 * - customerAfipService: Direct Supabase queries for customers_afip table (browser-compatible)
 * - afipAuth: CMS signing + WSAA SOAP login (requires node-forge, server-side for CORS)
 * - afipWsfev1: WSFEv1 SOAP operations (server-side for CORS)
 * - facturacionService: Full orchestration combining all services
 * - invoiceBuilder: Builder pattern for FECAERequest objects
 *
 * Dependencies:
 * - node-forge: For CMS/PKCS#7 signing (npm install node-forge @types/node-forge)
 *
 * IMPORTANT: AFIP SOAP endpoints do not support CORS. The afipAuth and afipWsfev1 
 * modules must run in a server-side environment (Node.js, Supabase Edge Function, 
 * Vercel Serverless, etc.) to communicate with AFIP web services.
 */

// Types
export type {
  AfipEnvironment,
  TenantAfipSettings,
  CustomerAfipResponse,
  CustomerCertificadoDto,
  CustomerCreateDto,
  CustomerUpdateDto,
  TokenInfo,
  AfipLoginResult,
  FacturaRequest,
  FacturaResponse,
  AlicIvaDto,
  FEAuthRequest,
  FECAERequest,
  FECabRequest,
  FECAEDetRequest,
  AlicIva,
  Tributo,
  CbteAsoc,
  Opcional,
  FECAEResponse,
  FECabResponse,
  FECAEDetResponse,
  AfipError,
  AfipEvent,
  AfipObservacion,
  FERecuperaLastCbteResponse,
  CbteTipoItem,
} from './types';

// Constants
export {
  AFIP_ENDPOINTS,
  SOAP_NS,
  TipoComprobante,
  TipoDocumento,
  TipoConcepto,
  TipoIVA,
  CondicionIVA,
} from './constants';

// Auth
export { obtenerLoginTicket, signMessageCMS, isTokenValid } from './afipAuth';

// WSFEv1
export {
  solicitarCAE,
  obtenerUltimoComprobanteAutorizado,
  obtenerTiposIva,
  obtenerTiposDoc,
  obtenerTiposComprobante,
  obtenerTiposMonedas,
  obtenerTiposConcepto,
  obtenerTiposTributos,
  obtenerTiposOpcional,
  obtenerPuntosVenta,
  obtenerCondicionIvaReceptor,
  obtenerCotizacion,
  consultarComprobante,
  verificarConexion,
} from './afipWsfev1';

// Invoice Builder
export {
  FECAERequestBuilder,
  FECAEDetRequestBuilder,
  crearFacturaSimple,
  crearNotaCredito,
} from './invoiceBuilder';

// Customer AFIP Service
export {
  obtenerTodos,
  obtenerPorId,
  obtenerPorCuit,
  existeClienteHabilitado,
  obtenerCertificadoDesencriptado,
  obtenerToken,
  actualizarToken,
  crearCliente,
  actualizarCliente,
  eliminarCliente,
  cambiarEstado,
} from './customerAfipService';

// Facturacion Service
export {
  asegurarLoginValido,
  generarFactura,
  generarNotaDeCredito,
  obtenerCliente,
  getTiposDocumento,
  getTipoComprobantes,
  getTipoConcepto,
  getCondicionIva,
  getTiposTributo,
  verificarConexionAfip,
} from './facturacionService';
