/**
 * Facturacion Service - Main orchestration for AFIP invoicing
 * Ported from afip_factura/Application/FacturacionService.cs
 *
 * Orchestrates the full invoice generation flow:
 * 1. Verify customer exists and is enabled
 * 2. Check/obtain valid AFIP login token
 * 3. Get last authorized voucher number
 * 4. Build invoice request
 * 5. Request CAE from AFIP
 * 6. Return structured response
 */

import { obtenerLoginTicket, isTokenValid } from './afipAuth';
import * as wsfev1 from './afipWsfev1';
import { crearFacturaSimple, crearNotaCredito } from './invoiceBuilder';
import {
  existeClienteHabilitado,
  obtenerCertificadoDesencriptado,
  obtenerToken,
  actualizarToken,
  obtenerPorCuit,
} from './customerAfipService';
import { TipoComprobante } from './constants';
import type {
  AfipEnvironment,
  FacturaRequest,
  FacturaResponse,
  CustomerAfipResponse,
  AlicIva,
} from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────────

function resolveEnvironment(ambiente: number): AfipEnvironment {
  return ambiente === 1 ? 'production' : 'homologation';
}

// ─── Login flow ──────────────────────────────────────────────────────────────────

/**
 * Ensure a valid AFIP login token exists for the given customer
 * If token is expired, performs a new login and updates the database
 *
 * Equivalent to FacturacionService.LoginValidoAsync in .NET
 */
export async function asegurarLoginValido(
  cliente: CustomerAfipResponse,
  ambiente: number
): Promise<boolean> {
  const environment = resolveEnvironment(ambiente);

  console.log(`[Facturacion] Checking login for CUIT: ${cliente.cuit}, environment: ${environment}`);

  // Check if existing token is still valid
  if (isTokenValid(cliente.fechaExpiracionToken)) {
    console.log(`[Facturacion] Existing token still valid for CUIT: ${cliente.cuit}`);
    return true;
  }

  // Token expired or doesn't exist - need to login
  console.log(`[Facturacion] Token expired or missing, performing AFIP login for CUIT: ${cliente.cuit}`);

  // Get decrypted certificate from database
  const certificadoDto = await obtenerCertificadoDesencriptado(cliente.cuit);
  if (!certificadoDto) {
    throw new Error(`Could not obtain certificate for CUIT ${cliente.cuit}`);
  }

  // Perform AFIP WSAA login
  const loginResult = await obtenerLoginTicket(
    'wsfe',
    certificadoDto.certificadoPem,
    certificadoDto.clavePrivadaPem,
    environment
  );

  // Update token in database
  const tokenUpdated = await actualizarToken(
    cliente.cuit,
    loginResult.token,
    loginResult.sign,
    loginResult.expirationTime
  );

  if (!tokenUpdated) {
    throw new Error(`Could not update token in database for CUIT ${cliente.cuit}`);
  }

  console.log(`[Facturacion] Login successful for CUIT: ${cliente.cuit}, expires: ${loginResult.expirationTime.toISOString()}`);

  return true;
}

// ─── Invoice Generation ──────────────────────────────────────────────────────────

/**
 * Generate an invoice (Factura)
 * Full flow: validate customer → login → get last number → build request → request CAE
 *
 * Equivalent to FacturacionService.GenerarFactura in .NET
 */
export async function generarFactura(facturaRequest: FacturaRequest): Promise<FacturaResponse> {
  const environment = resolveEnvironment(facturaRequest.ambiente);

  console.log(`[Facturacion] Generating invoice for CUIT: ${facturaRequest.cuit}, Type: ${facturaRequest.tipoComprobante}, PtoVta: ${facturaRequest.puntoVenta}`);

  try {
    // Step 1: Get customer and verify
    const datosCliente = await existeClienteHabilitado(facturaRequest.cuit.toString());
    if (!datosCliente) {
      throw new Error(`Customer with CUIT ${facturaRequest.cuit} not found or not enabled.`);
    }

    // Step 2: Ensure valid login
    await asegurarLoginValido(datosCliente, facturaRequest.ambiente);

    // Step 3: Get token from DB
    const tokenInfo = await obtenerToken(facturaRequest.cuit.toString());
    if (!tokenInfo) {
      throw new Error(`Could not get token for CUIT ${facturaRequest.cuit}`);
    }

    // Step 4: Get last authorized voucher number
    const ultimoComp = await wsfev1.obtenerUltimoComprobanteAutorizado(
      tokenInfo.token,
      tokenInfo.sign,
      facturaRequest.cuit,
      facturaRequest.puntoVenta,
      facturaRequest.tipoComprobante,
      environment
    );

    if (ultimoComp.errors && ultimoComp.errors.length > 0) {
      throw new Error(`AFIP error getting last voucher: ${ultimoComp.errors.map(e => e.msg).join(', ')}`);
    }

    const nextNumber = ultimoComp.cbteNro + 1;
    console.log(`[Facturacion] Last voucher: ${ultimoComp.cbteNro}, next: ${nextNumber}`);

    // Step 5: Build IVA list
    const ivaList: AlicIva[] = facturaRequest.ivaList.map(item => ({
      id: item.id,
      baseImp: item.baseImponible,
      importe: item.importe,
    }));

    // Step 6: Create invoice request
    const factura = crearFacturaSimple(
      facturaRequest.puntoVenta,
      nextNumber,
      facturaRequest.tipoComprobante,
      facturaRequest.fechaComprobante,
      facturaRequest.tipoConcepto,
      facturaRequest.tipoDocCliente,
      facturaRequest.dniCliente,
      facturaRequest.importeTotal,
      facturaRequest.importeNeto,
      facturaRequest.importeIVA,
      facturaRequest.moneda,
      facturaRequest.cotizacion,
      ivaList
    );

    // For Factura C, clear IVA
    if (facturaRequest.tipoComprobante === TipoComprobante.FacturaC) {
      factura.feDetReq[0].iva = null;
    }

    // Step 7: Request CAE from AFIP
    console.log('[Facturacion] Requesting CAE from AFIP');
    const respuestaFactura = await wsfev1.solicitarCAE(
      tokenInfo.token,
      tokenInfo.sign,
      facturaRequest.cuit,
      factura,
      environment
    );
    console.log('[Facturacion] respuestaFactura from AFIP', respuestaFactura);

    if (!respuestaFactura || !respuestaFactura.feDetResp || respuestaFactura.feDetResp.length === 0) {
      return {
        cae: '',
        caeFchVto: '',
        resultado: 'Error al procesar la factura',
        observacion: respuestaFactura?.errors?.map(e => e.msg).join(', ') || '',
      };
    }

    // Get voucher type description
    let tipoComprobanteDesc = '';
    try {
      const comprobantesTipo = await wsfev1.obtenerTiposComprobante(
        tokenInfo.token, tokenInfo.sign, facturaRequest.cuit, environment
      );
      const tipo = comprobantesTipo.find(t => t.id === respuestaFactura.feCabResp.cbteTipo);
      if (tipo) tipoComprobanteDesc = tipo.desc;
    } catch {
      // Non-critical, continue without description
    }

    const detResp = respuestaFactura.feDetResp[0];
    const ptoVtaPadded = String(respuestaFactura.feCabResp.ptoVta).padStart(4, '0');
    const cbteNroPadded = String(detResp.cbteHasta).padStart(8, '0');

    console.log(`[Facturacion] Invoice processed. Result: ${detResp.resultado}, CAE: ${detResp.cae}`);

    return {
      cae: detResp.cae,
      caeFchVto: detResp.caeFchVto,
      resultado: detResp.resultado,
      observacion: detResp.observaciones
        ? detResp.observaciones.map(o => o.msg).join(', ')
        : '',
      comprobanteTipo: respuestaFactura.feCabResp.cbteTipo,
      comprobanteNro: String(detResp.cbteHasta),
      comprobanteDescripcion: `${tipoComprobanteDesc} ${ptoVtaPadded}-${cbteNroPadded}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Facturacion] Error generating invoice for CUIT ${facturaRequest.cuit}: ${msg}`);
    throw err;
  }
}

/**
 * Generate a credit note (Nota de Crédito)
 * Equivalent to FacturacionService.GenerarNotaDeCredito in .NET
 */
export async function generarNotaDeCredito(facturaRequest: FacturaRequest): Promise<FacturaResponse> {
  const environment = resolveEnvironment(facturaRequest.ambiente);

  console.log(`[Facturacion] Generating credit note for CUIT: ${facturaRequest.cuit}, Type: ${facturaRequest.tipoComprobante}`);

  try {
    // Step 1: Get customer and verify
    const datosCliente = await existeClienteHabilitado(facturaRequest.cuit.toString());
    if (!datosCliente) {
      throw new Error(`Customer with CUIT ${facturaRequest.cuit} not found or not enabled.`);
    }

    // Step 2: Ensure valid login
    await asegurarLoginValido(datosCliente, facturaRequest.ambiente);

    // Step 3: Get token from DB
    const tokenInfo = await obtenerToken(facturaRequest.cuit.toString());
    if (!tokenInfo) {
      throw new Error(`Could not get token for CUIT ${facturaRequest.cuit}`);
    }

    // Step 4: Get last authorized voucher
    const ultimoComp = await wsfev1.obtenerUltimoComprobanteAutorizado(
      tokenInfo.token,
      tokenInfo.sign,
      facturaRequest.cuit,
      facturaRequest.puntoVenta,
      facturaRequest.tipoComprobante,
      environment
    );

    const nextNumber = ultimoComp.cbteNro + 1;
    console.log(`[Facturacion] Last credit note: ${ultimoComp.cbteNro}, next: ${nextNumber}`);

    // Step 5: Build IVA list
    const ivaList: AlicIva[] = facturaRequest.ivaList.map(item => ({
      id: item.id,
      baseImp: item.baseImponible,
      importe: item.importe,
    }));

    // Step 6: Create credit note request
    const factura = crearNotaCredito(
      facturaRequest.puntoVenta,
      nextNumber,
      facturaRequest.tipoComprobante,
      facturaRequest.fechaComprobante,
      facturaRequest.tipoFacturaOriginal || 0,
      facturaRequest.puntoDeVentaOriginal || 0,
      facturaRequest.numeroFactura || 0,
      facturaRequest.tipoDocCliente,
      facturaRequest.dniCliente,
      facturaRequest.importeTotal,
      facturaRequest.importeNeto,
      facturaRequest.importeIVA,
      facturaRequest.moneda,
      facturaRequest.cotizacion,
      ivaList
    );

    // Step 7: Request CAE from AFIP
    console.log('[Facturacion] Requesting CAE for credit note from AFIP');
    const respuestaFactura = await wsfev1.solicitarCAE(
      tokenInfo.token,
      tokenInfo.sign,
      facturaRequest.cuit,
      factura,
      environment
    );

    if (!respuestaFactura || !respuestaFactura.feDetResp || respuestaFactura.feDetResp.length === 0) {
      return {
        cae: '',
        caeFchVto: '',
        resultado: 'Error al procesar la nota de crédito',
        observacion: respuestaFactura?.errors?.map(e => e.msg).join(', ') || '',
      };
    }

    const detResp = respuestaFactura.feDetResp[0];

    console.log(`[Facturacion] Credit note processed. Result: ${detResp.resultado}, CAE: ${detResp.cae}`);

    return {
      cae: detResp.cae,
      caeFchVto: detResp.caeFchVto,
      resultado: detResp.resultado,
      observacion: detResp.observaciones
        ? detResp.observaciones.map(o => o.msg).join(', ')
        : '',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Facturacion] Error generating credit note for CUIT ${facturaRequest.cuit}: ${msg}`);
    throw err;
  }
}

// ─── Auxiliary functions (exposed from .NET API) ─────────────────────────────────

/**
 * Get customer data by CUIT
 */
export async function obtenerCliente(cuit: string): Promise<CustomerAfipResponse | null> {
  if (!cuit || cuit.length !== 11 || !/^\d{11}$/.test(cuit)) {
    console.warn(`Invalid CUIT format: ${cuit}`);
    return null;
  }
  return obtenerPorCuit(cuit);
}

/**
 * Get document types from AFIP (requires valid login)
 */
export async function getTiposDocumento(cuit: number, ambiente: number = 2) {
  const environment = resolveEnvironment(ambiente);
  const cliente = await existeClienteHabilitado(cuit.toString());
  if (!cliente) throw new Error(`Customer with CUIT ${cuit} not found`);
  await asegurarLoginValido(cliente, ambiente);

  const tokenInfo = await obtenerToken(cuit.toString());
  if (!tokenInfo) throw new Error(`No token for CUIT ${cuit}`);

  return wsfev1.obtenerTiposDoc(tokenInfo.token, tokenInfo.sign, cuit, environment);
}

/**
 * Get voucher types from AFIP (requires valid login)
 */
export async function getTipoComprobantes(cuit: number, ambiente: number = 2) {
  const environment = resolveEnvironment(ambiente);
  const cliente = await existeClienteHabilitado(cuit.toString());
  if (!cliente) throw new Error(`Customer with CUIT ${cuit} not found`);
  await asegurarLoginValido(cliente, ambiente);

  const tokenInfo = await obtenerToken(cuit.toString());
  if (!tokenInfo) throw new Error(`No token for CUIT ${cuit}`);

  return wsfev1.obtenerTiposComprobante(tokenInfo.token, tokenInfo.sign, cuit, environment);
}

/**
 * Get concept types from AFIP (requires valid login)
 */
export async function getTipoConcepto(cuit: number, ambiente: number = 2) {
  const environment = resolveEnvironment(ambiente);
  const cliente = await existeClienteHabilitado(cuit.toString());
  if (!cliente) throw new Error(`Customer with CUIT ${cuit} not found`);
  await asegurarLoginValido(cliente, ambiente);

  const tokenInfo = await obtenerToken(cuit.toString());
  if (!tokenInfo) throw new Error(`No token for CUIT ${cuit}`);

  return wsfev1.obtenerTiposConcepto(tokenInfo.token, tokenInfo.sign, cuit, environment);
}

/**
 * Get IVA conditions from AFIP (requires valid login)
 */
export async function getCondicionIva(cuit: number, ambiente: number = 2) {
  const environment = resolveEnvironment(ambiente);
  const cliente = await existeClienteHabilitado(cuit.toString());
  if (!cliente) throw new Error(`Customer with CUIT ${cuit} not found`);
  await asegurarLoginValido(cliente, ambiente);

  const tokenInfo = await obtenerToken(cuit.toString());
  if (!tokenInfo) throw new Error(`No token for CUIT ${cuit}`);

  return wsfev1.obtenerCondicionIvaReceptor(tokenInfo.token, tokenInfo.sign, cuit, environment);
}

/**
 * Get tribute types from AFIP (requires valid login)
 */
export async function getTiposTributo(cuit: number, ambiente: number = 2) {
  const environment = resolveEnvironment(ambiente);
  const cliente = await existeClienteHabilitado(cuit.toString());
  if (!cliente) throw new Error(`Customer with CUIT ${cuit} not found`);
  await asegurarLoginValido(cliente, ambiente);

  const tokenInfo = await obtenerToken(cuit.toString());
  if (!tokenInfo) throw new Error(`No token for CUIT ${cuit}`);

  return wsfev1.obtenerTiposTributos(tokenInfo.token, tokenInfo.sign, cuit, environment);
}

/**
 * Test AFIP WSFEv1 connection
 */
export async function verificarConexionAfip(ambiente: number = 2) {
  const environment = resolveEnvironment(ambiente);
  return wsfev1.verificarConexion(environment);
}
