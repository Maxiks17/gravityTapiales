/**
 * AFIP WSFEv1 Service - Electronic Invoicing Web Service
 * Ported from afip_wsfev1 (.NET) - Wsfev1.cs
 *
 * Handles all SOAP communication with AFIP's WSFEv1 service:
 * - CAE requests (FECAESolicitar)
 * - Last authorized voucher (FECompUltimoAutorizado)
 * - Voucher queries (FECompConsultar)
 * - Parameter queries (types of IVA, documents, currencies, etc.)
 * - Connection test (FEDummy)
 *
 * NOTE: Requires server-side execution due to CORS restrictions on AFIP endpoints.
 */

import { AFIP_ENDPOINTS, SOAP_NS } from './constants';
import {
  buildFECAESolicitarEnvelope,
  buildFECompUltimoAutorizadoEnvelope,
  buildFECompConsultarEnvelope,
  buildFEParamGetEnvelope,
  buildFEDummyEnvelope,
  extractXmlValue,
  extractXmlBlock,
  extractAllXmlBlocks,
  extractXmlNumber,
  extractSoapFault,
} from './xmlHelpers';
import type {
  AfipEnvironment,
  FECAERequest,
  FECAEResponse,
  FECabResponse,
  FECAEDetResponse,
  FERecuperaLastCbteResponse,
  AfipError,
  AfipObservacion,
  CbteTipoItem,
} from './types';

/**
 * Get the WSFEv1 endpoint URL for the given environment
 */
function getWsfev1Url(environment: AfipEnvironment): string {
  return environment === 'production'
    ? AFIP_ENDPOINTS.wsfev1.production
    : AFIP_ENDPOINTS.wsfev1.homologation;
}

/**
 * Make a SOAP request to WSFEv1
 */
async function soapCall(url: string, action: string, envelope: string): Promise<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': `${SOAP_NS.wsfev1}${action}`,
    },
    body: envelope,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WSFEv1 HTTP error ${response.status}: ${errorText}`);
  }

  const responseText = await response.text();

  const fault = extractSoapFault(responseText);
  if (fault) {
    throw new Error(`WSFEv1 SOAP Fault: ${fault}`);
  }

  return responseText;
}

/**
 * Parse AFIP errors from a response block
 */
function parseErrors(xml: string): AfipError[] | undefined {
  const errorsBlock = extractXmlBlock(xml, 'Errors');
  if (!errorsBlock) return undefined;

  const errBlocks = extractAllXmlBlocks(errorsBlock, 'Err');
  if (errBlocks.length === 0) return undefined;

  return errBlocks.map(block => ({
    code: extractXmlNumber(block, 'Code'),
    msg: extractXmlValue(block, 'Msg') || '',
  }));
}

/**
 * Parse observations from a response block
 */
function parseObservaciones(xml: string): AfipObservacion[] | undefined {
  const obsBlock = extractXmlBlock(xml, 'Observaciones');
  if (!obsBlock) return undefined;

  const obsBlocks = extractAllXmlBlocks(obsBlock, 'Obs');
  if (obsBlocks.length === 0) return undefined;

  return obsBlocks.map(block => ({
    code: extractXmlNumber(block, 'Code'),
    msg: extractXmlValue(block, 'Msg') || '',
  }));
}

// ─── CAE Operations ──────────────────────────────────────────────────────────────

/**
 * Request CAE (Código de Autorización Electrónico)
 * Equivalent to Wsfev1.SolicitarCAEAsync in .NET
 */
export async function solicitarCAE(
  token: string,
  sign: string,
  cuit: number,
  feCAEReq: FECAERequest,
  environment: AfipEnvironment = 'homologation'
): Promise<FECAEResponse> {
  const url = getWsfev1Url(environment);

  const envelope = buildFECAESolicitarEnvelope(
    token,
    sign,
    cuit,
    feCAEReq.feCabReq,
    feCAEReq.feDetReq.map(d => ({
      concepto: d.concepto,
      docTipo: d.docTipo,
      docNro: d.docNro,
      cbteDesde: d.cbteDesde,
      cbteHasta: d.cbteHasta,
      cbteFch: d.cbteFch,
      impTotal: d.impTotal,
      impTotConc: d.impTotConc,
      impNeto: d.impNeto,
      impOpEx: d.impOpEx,
      impTrib: d.impTrib,
      impIVA: d.impIVA,
      monId: d.monId,
      monCotiz: d.monCotiz,
      condicionIVAReceptorId: d.condicionIVAReceptorId,
      fchServDesde: d.fchServDesde,
      fchServHasta: d.fchServHasta,
      fchVtoPago: d.fchVtoPago,
      iva: d.iva,
      tributos: d.tributos,
      cbtesAsoc: d.cbtesAsoc,
      opcionales: d.opcionales,
    }))
  );

  const responseXml = await soapCall(url, 'FECAESolicitar', envelope);

  // Parse the result
  const resultBlock = extractXmlBlock(responseXml, 'FECAESolicitarResult');
  if (!resultBlock) {
    throw new Error('Invalid FECAESolicitar response: result block not found');
  }

  // Parse header response
  const cabRespBlock = extractXmlBlock(resultBlock, 'FeCabResp');
  const feCabResp: FECabResponse = {
    cuit: extractXmlNumber(cabRespBlock || '', 'Cuit'),
    ptoVta: extractXmlNumber(cabRespBlock || '', 'PtoVta'),
    cbteTipo: extractXmlNumber(cabRespBlock || '', 'CbteTipo'),
    fchProceso: extractXmlValue(cabRespBlock || '', 'FchProceso') || '',
    cantReg: extractXmlNumber(cabRespBlock || '', 'CantReg'),
    resultado: extractXmlValue(cabRespBlock || '', 'Resultado') || '',
    reproceso: extractXmlValue(cabRespBlock || '', 'Reproceso') || '',
  };

  // Parse detail responses
  const detRespBlock = extractXmlBlock(resultBlock, 'FeDetResp');
  const detBlocks = extractAllXmlBlocks(detRespBlock || '', 'FECAEDetResponse');
  const feDetResp: FECAEDetResponse[] = detBlocks.map(block => ({
    concepto: extractXmlNumber(block, 'Concepto'),
    docTipo: extractXmlNumber(block, 'DocTipo'),
    docNro: extractXmlNumber(block, 'DocNro'),
    cbteDesde: extractXmlNumber(block, 'CbteDesde'),
    cbteHasta: extractXmlNumber(block, 'CbteHasta'),
    cbteFch: extractXmlValue(block, 'CbteFch') || '',
    resultado: extractXmlValue(block, 'Resultado') || '',
    cae: extractXmlValue(block, 'CAE') || '',
    caeFchVto: extractXmlValue(block, 'CAEFchVto') || '',
    observaciones: parseObservaciones(block),
  }));

  const errors = parseErrors(resultBlock);

  return {
    feCabResp,
    feDetResp,
    errors,
  };
}

/**
 * Get the last authorized voucher number
 * Equivalent to Wsfev1.ObtenerUltimoComprobanteAutorizadoAsync in .NET
 */
export async function obtenerUltimoComprobanteAutorizado(
  token: string,
  sign: string,
  cuit: number,
  ptoVta: number,
  cbteTipo: number,
  environment: AfipEnvironment = 'homologation'
): Promise<FERecuperaLastCbteResponse> {
  const url = getWsfev1Url(environment);
  const envelope = buildFECompUltimoAutorizadoEnvelope(token, sign, cuit, ptoVta, cbteTipo);
  const responseXml = await soapCall(url, 'FECompUltimoAutorizado', envelope);

  const resultBlock = extractXmlBlock(responseXml, 'FECompUltimoAutorizadoResult');
  if (!resultBlock) {
    throw new Error('Invalid FECompUltimoAutorizado response');
  }

  return {
    ptoVta: extractXmlNumber(resultBlock, 'PtoVta'),
    cbteTipo: extractXmlNumber(resultBlock, 'CbteTipo'),
    cbteNro: extractXmlNumber(resultBlock, 'CbteNro'),
    errors: parseErrors(resultBlock),
  };
}

// ─── Parameter Queries ───────────────────────────────────────────────────────────

/**
 * Generic parameter query helper
 */
async function paramQuery(
  action: string,
  token: string,
  sign: string,
  cuit: number,
  environment: AfipEnvironment,
  extraParams?: string
): Promise<string> {
  const url = getWsfev1Url(environment);
  const envelope = buildFEParamGetEnvelope(action, token, sign, cuit, extraParams);
  return soapCall(url, action, envelope);
}

/**
 * Get available IVA types
 */
export async function obtenerTiposIva(
  token: string, sign: string, cuit: number,
  environment: AfipEnvironment = 'homologation'
) {
  const xml = await paramQuery('FEParamGetTiposIva', token, sign, cuit, environment);
  const resultBlock = extractXmlBlock(xml, 'FEParamGetTiposIvaResult');
  const items = extractAllXmlBlocks(resultBlock || '', 'IvaTipo');
  return items.map(block => ({
    id: extractXmlNumber(block, 'Id'),
    desc: extractXmlValue(block, 'Desc') || '',
    fchDesde: extractXmlValue(block, 'FchDesde') || '',
    fchHasta: extractXmlValue(block, 'FchHasta') || '',
  }));
}

/**
 * Get available document types
 */
export async function obtenerTiposDoc(
  token: string, sign: string, cuit: number,
  environment: AfipEnvironment = 'homologation'
) {
  const xml = await paramQuery('FEParamGetTiposDoc', token, sign, cuit, environment);
  const resultBlock = extractXmlBlock(xml, 'FEParamGetTiposDocResult');
  const items = extractAllXmlBlocks(resultBlock || '', 'DocTipo');
  return items.map(block => ({
    id: extractXmlNumber(block, 'Id'),
    desc: extractXmlValue(block, 'Desc') || '',
    fchDesde: extractXmlValue(block, 'FchDesde') || '',
    fchHasta: extractXmlValue(block, 'FchHasta') || '',
  }));
}

/**
 * Get available voucher types
 */
export async function obtenerTiposComprobante(
  token: string, sign: string, cuit: number,
  environment: AfipEnvironment = 'homologation'
): Promise<CbteTipoItem[]> {
  const xml = await paramQuery('FEParamGetTiposCbte', token, sign, cuit, environment);
  const resultBlock = extractXmlBlock(xml, 'FEParamGetTiposCbteResult');
  const items = extractAllXmlBlocks(resultBlock || '', 'CbteTipo');
  return items.map(block => ({
    id: extractXmlNumber(block, 'Id'),
    desc: extractXmlValue(block, 'Desc') || '',
    fchDesde: extractXmlValue(block, 'FchDesde') || '',
    fchHasta: extractXmlValue(block, 'FchHasta') || '',
  }));
}

/**
 * Get available currencies
 */
export async function obtenerTiposMonedas(
  token: string, sign: string, cuit: number,
  environment: AfipEnvironment = 'homologation'
) {
  const xml = await paramQuery('FEParamGetTiposMonedas', token, sign, cuit, environment);
  const resultBlock = extractXmlBlock(xml, 'FEParamGetTiposMonedasResult');
  const items = extractAllXmlBlocks(resultBlock || '', 'Moneda');
  return items.map(block => ({
    id: extractXmlValue(block, 'Id') || '',
    desc: extractXmlValue(block, 'Desc') || '',
    fchDesde: extractXmlValue(block, 'FchDesde') || '',
    fchHasta: extractXmlValue(block, 'FchHasta') || '',
  }));
}

/**
 * Get available concept types
 */
export async function obtenerTiposConcepto(
  token: string, sign: string, cuit: number,
  environment: AfipEnvironment = 'homologation'
) {
  const xml = await paramQuery('FEParamGetTiposConcepto', token, sign, cuit, environment);
  const resultBlock = extractXmlBlock(xml, 'FEParamGetTiposConceptoResult');
  const items = extractAllXmlBlocks(resultBlock || '', 'ConceptoTipo');
  return items.map(block => ({
    id: extractXmlNumber(block, 'Id'),
    desc: extractXmlValue(block, 'Desc') || '',
    fchDesde: extractXmlValue(block, 'FchDesde') || '',
    fchHasta: extractXmlValue(block, 'FchHasta') || '',
  }));
}

/**
 * Get available tribute types
 */
export async function obtenerTiposTributos(
  token: string, sign: string, cuit: number,
  environment: AfipEnvironment = 'homologation'
) {
  const xml = await paramQuery('FEParamGetTiposTributos', token, sign, cuit, environment);
  const resultBlock = extractXmlBlock(xml, 'FEParamGetTiposTributosResult');
  const items = extractAllXmlBlocks(resultBlock || '', 'TributoTipo');
  return items.map(block => ({
    id: extractXmlNumber(block, 'Id'),
    desc: extractXmlValue(block, 'Desc') || '',
    fchDesde: extractXmlValue(block, 'FchDesde') || '',
    fchHasta: extractXmlValue(block, 'FchHasta') || '',
  }));
}

/**
 * Get available optional types
 */
export async function obtenerTiposOpcional(
  token: string, sign: string, cuit: number,
  environment: AfipEnvironment = 'homologation'
) {
  const xml = await paramQuery('FEParamGetTiposOpcional', token, sign, cuit, environment);
  const resultBlock = extractXmlBlock(xml, 'FEParamGetTiposOpcionalResult');
  const items = extractAllXmlBlocks(resultBlock || '', 'OpcionalTipo');
  return items.map(block => ({
    id: extractXmlValue(block, 'Id') || '',
    desc: extractXmlValue(block, 'Desc') || '',
    fchDesde: extractXmlValue(block, 'FchDesde') || '',
    fchHasta: extractXmlValue(block, 'FchHasta') || '',
  }));
}

/**
 * Get registered sales points
 */
export async function obtenerPuntosVenta(
  token: string, sign: string, cuit: number,
  environment: AfipEnvironment = 'homologation'
) {
  const xml = await paramQuery('FEParamGetPtosVenta', token, sign, cuit, environment);
  const resultBlock = extractXmlBlock(xml, 'FEParamGetPtosVentaResult');
  const items = extractAllXmlBlocks(resultBlock || '', 'PtoVenta');
  return items.map(block => ({
    nro: extractXmlNumber(block, 'Nro'),
    emisionTipo: extractXmlValue(block, 'EmisionTipo') || '',
    bloqueado: extractXmlValue(block, 'Bloqueado') || '',
    fchBaja: extractXmlValue(block, 'FchBaja') || '',
  }));
}

/**
 * Get recipient IVA conditions
 */
export async function obtenerCondicionIvaReceptor(
  token: string, sign: string, cuit: number,
  environment: AfipEnvironment = 'homologation'
) {
  const xml = await paramQuery('FEParamGetCondicionIvaReceptor', token, sign, cuit, environment);
  const resultBlock = extractXmlBlock(xml, 'FEParamGetCondicionIvaReceptorResult');
  const items = extractAllXmlBlocks(resultBlock || '', 'CondicionIvaReceptor');
  return items.map(block => ({
    id: extractXmlNumber(block, 'Id'),
    desc: extractXmlValue(block, 'Desc') || '',
    fchDesde: extractXmlValue(block, 'FchDesde') || '',
    fchHasta: extractXmlValue(block, 'FchHasta') || '',
  }));
}

/**
 * Get exchange rate for a currency
 */
export async function obtenerCotizacion(
  token: string, sign: string, cuit: number,
  monId: string, fchCotiz: string,
  environment: AfipEnvironment = 'homologation'
) {
  const extraParams = `<ar:MonId>${monId}</ar:MonId>\n      <ar:FchCotiz>${fchCotiz}</ar:FchCotiz>`;
  const xml = await paramQuery('FEParamGetCotizacion', token, sign, cuit, environment, extraParams);
  const resultBlock = extractXmlBlock(xml, 'FEParamGetCotizacionResult');
  return {
    monId: extractXmlValue(resultBlock || '', 'MonId') || '',
    monCotiz: Number(extractXmlValue(resultBlock || '', 'MonCotiz') || '0'),
    fchCotiz: extractXmlValue(resultBlock || '', 'FchCotiz') || '',
  };
}

/**
 * Query a specific voucher
 */
export async function consultarComprobante(
  token: string, sign: string, cuit: number,
  cbteTipo: number, cbteNro: number, ptoVta: number,
  environment: AfipEnvironment = 'homologation'
) {
  const url = getWsfev1Url(environment);
  const envelope = buildFECompConsultarEnvelope(token, sign, cuit, cbteTipo, cbteNro, ptoVta);
  const responseXml = await soapCall(url, 'FECompConsultar', envelope);

  const resultBlock = extractXmlBlock(responseXml, 'FECompConsultarResult');
  if (!resultBlock) {
    throw new Error('Invalid FECompConsultar response');
  }

  const resultGetBlock = extractXmlBlock(resultBlock, 'ResultGet');
  if (!resultGetBlock) {
    return { errors: parseErrors(resultBlock) };
  }

  return {
    concepto: extractXmlNumber(resultGetBlock, 'Concepto'),
    docTipo: extractXmlNumber(resultGetBlock, 'DocTipo'),
    docNro: extractXmlNumber(resultGetBlock, 'DocNro'),
    cbteDesde: extractXmlNumber(resultGetBlock, 'CbteDesde'),
    cbteHasta: extractXmlNumber(resultGetBlock, 'CbteHasta'),
    cbteFch: extractXmlValue(resultGetBlock, 'CbteFch') || '',
    impTotal: Number(extractXmlValue(resultGetBlock, 'ImpTotal') || '0'),
    impNeto: Number(extractXmlValue(resultGetBlock, 'ImpNeto') || '0'),
    impIVA: Number(extractXmlValue(resultGetBlock, 'ImpIVA') || '0'),
    monId: extractXmlValue(resultGetBlock, 'MonId') || '',
    monCotiz: Number(extractXmlValue(resultGetBlock, 'MonCotiz') || '0'),
    cae: extractXmlValue(resultGetBlock, 'CodAutorizacion') || '',
    caeFchVto: extractXmlValue(resultGetBlock, 'FchVto') || '',
    resultado: extractXmlValue(resultGetBlock, 'Resultado') || '',
    errors: parseErrors(resultBlock),
  };
}

/**
 * Verify WSFEv1 connection (FEDummy)
 */
export async function verificarConexion(
  environment: AfipEnvironment = 'homologation'
) {
  const url = getWsfev1Url(environment);
  const envelope = buildFEDummyEnvelope();
  const responseXml = await soapCall(url, 'FEDummy', envelope);

  const resultBlock = extractXmlBlock(responseXml, 'FEDummyResult');
  return {
    appServer: extractXmlValue(resultBlock || '', 'AppServer') || '',
    dbServer: extractXmlValue(resultBlock || '', 'DbServer') || '',
    authServer: extractXmlValue(resultBlock || '', 'AuthServer') || '',
  };
}
