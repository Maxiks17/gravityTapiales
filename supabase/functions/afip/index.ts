/**
 * Supabase Edge Function: AFIP Invoice Service
 *
 * Server-side proxy for AFIP SOAP calls (WSAA + WSFEv1).
 * Required because AFIP endpoints don't support CORS.
 *
 * Actions:
 *   - generate-invoice: Full invoice generation flow
 *   - generate-credit-note: Credit note generation
 *   - check-connection: Test AFIP WSFEv1 connectivity
 *   - get-tipos-documento, get-tipos-comprobante, get-tipos-concepto,
 *     get-condicion-iva, get-tipos-tributo: Parameter queries
 */

// @ts-ignore: Deno-specific import
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore: Deno-specific import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
// @ts-ignore: Deno npm compat
import forge from 'npm:node-forge@1.3.3';

// ─────────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────────

type AfipEnvironment = 'production' | 'homologation';

interface FacturaRequest {
  ambiente: number;
  cuit: number;
  puntoVenta: number;
  tipoComprobante: number;
  tipoConcepto: number;
  tipoDocCliente: number;
  dniCliente: number;
  importeTotal: number;
  importeNeto: number;
  importeIVA: number;
  impTrib?: number;
  moneda: string;
  cotizacion: number;
  condicionIVAReceptorId?: number;
  ivaList: { id: number; baseImponible: number; importe: number }[];
  fechaComprobante: string;
  numeroFactura?: number;
  tipoFacturaOriginal?: number;
  puntoDeVentaOriginal?: number;
}

interface AlicIva {
  id: number;
  baseImp: number;
  importe: number;
}

interface FECAERequest {
  feCabReq: { cantReg: number; ptoVta: number; cbteTipo: number };
  feDetReq: FECAEDetRequest[];
}

interface FECAEDetRequest {
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
  iva: AlicIva[] | null;
  cbtesAsoc?: { tipo: number; ptoVta: number; nro: number; cuit?: string; cbteFch?: string }[];
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────────

const AFIP_ENDPOINTS = {
  wsaa: {
    homologation: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
    production: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
  },
  wsfev1: {
    homologation: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
    production: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
  },
};

const WSFEV1_NS = 'http://ar.gov.afip.dif.FEV1/';

const TipoComprobante_FacturaC = 11;

// ─────────────────────────────────────────────────────────────────────────────────
// XML Helpers
// ─────────────────────────────────────────────────────────────────────────────────

function extractXmlValue(xml: string, tag: string): string | null {
  const regex = new RegExp(`<(?:[\\w]+:)?${tag}[^>]*>([^<]*)</(?:[\\w]+:)?${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function extractXmlBlock(xml: string, tag: string): string | null {
  const regex = new RegExp(`<(?:[\\w]+:)?${tag}[^>]*>(.*?)</(?:[\\w]+:)?${tag}>`, 'is');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function extractAllXmlBlocks(xml: string, tag: string): string[] {
  const regex = new RegExp(`<(?:[\\w]+:)?${tag}[^>]*>(.*?)</(?:[\\w]+:)?${tag}>`, 'gis');
  return [...xml.matchAll(regex)].map(m => m[1].trim());
}

function extractXmlNumber(xml: string, tag: string): number {
  const val = extractXmlValue(xml, tag);
  return val ? Number(val) : 0;
}

function extractSoapFault(xml: string): string | null {
  return extractXmlValue(xml, 'faultstring') || null;
}

// ─── SOAP envelope builders ──────────────────────────────────────────────────────

function buildLoginTicketRequest(service: string, uniqueId: number): string {
  const now = new Date();
  const gen = new Date(now.getTime() - 10 * 60 * 1000);
  const exp = new Date(now.getTime() + 10 * 60 * 1000);
  // AFIP requires ISO 8601 with timezone — use full ISO string (with Z for UTC)
  const fmt = (d: Date) => d.toISOString();
  return `<loginTicketRequest><header><uniqueId>${uniqueId}</uniqueId><generationTime>${fmt(gen)}</generationTime><expirationTime>${fmt(exp)}</expirationTime></header><service>${service}</service></loginTicketRequest>`;
}

function buildWsaaLoginEnvelope(signedCms: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soap:Body>
    <wsaa:loginCms>
      <wsaa:in0>${signedCms}</wsaa:in0>
    </wsaa:loginCms>
  </soap:Body>
</soap:Envelope>`;
}

function buildAuthXml(token: string, sign: string, cuit: number): string {
  return `<ar:Auth><ar:Token>${token}</ar:Token><ar:Sign>${sign}</ar:Sign><ar:Cuit>${cuit}</ar:Cuit></ar:Auth>`;
}

function buildWsfev1Envelope(action: string, body: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="${WSFEV1_NS}">
  <soap:Body>
    <ar:${action}>${body}</ar:${action}>
  </soap:Body>
</soap:Envelope>`;
}

function buildFEDummyEnvelope(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="${WSFEV1_NS}">
  <soap:Body><ar:FEDummy /></soap:Body>
</soap:Envelope>`;
}

function buildFECompUltimoAutorizadoEnvelope(token: string, sign: string, cuit: number, ptoVta: number, cbteTipo: number): string {
  return buildWsfev1Envelope('FECompUltimoAutorizado',
    `${buildAuthXml(token, sign, cuit)}<ar:PtoVta>${ptoVta}</ar:PtoVta><ar:CbteTipo>${cbteTipo}</ar:CbteTipo>`);
}

function buildFEParamGetEnvelope(action: string, token: string, sign: string, cuit: number): string {
  return buildWsfev1Envelope(action, buildAuthXml(token, sign, cuit));
}

function buildFECAESolicitarEnvelope(
  token: string, sign: string, cuit: number,
  cab: { cantReg: number; ptoVta: number; cbteTipo: number },
  detalles: FECAEDetRequest[]
): string {
  const detXml = detalles.map(d => {
    let ivaXml = '';
    if (d.iva && d.iva.length > 0) {
      ivaXml = '<ar:Iva>' + d.iva.map(i =>
        `<ar:AlicIva><ar:Id>${i.id}</ar:Id><ar:BaseImp>${i.baseImp}</ar:BaseImp><ar:Importe>${i.importe}</ar:Importe></ar:AlicIva>`
      ).join('') + '</ar:Iva>';
    }
    let asocXml = '';
    if (d.cbtesAsoc && d.cbtesAsoc.length > 0) {
      asocXml = '<ar:CbtesAsoc>' + d.cbtesAsoc.map(a => {
        let inner = `<ar:Tipo>${a.tipo}</ar:Tipo><ar:PtoVta>${a.ptoVta}</ar:PtoVta><ar:Nro>${a.nro}</ar:Nro>`;
        if (a.cuit) inner += `<ar:Cuit>${a.cuit}</ar:Cuit>`;
        if (a.cbteFch) inner += `<ar:CbteFch>${a.cbteFch}</ar:CbteFch>`;
        return `<ar:CbteAsoc>${inner}</ar:CbteAsoc>`;
      }).join('') + '</ar:CbtesAsoc>';
    }
    return `<ar:FECAEDetRequest>
      <ar:Concepto>${d.concepto}</ar:Concepto>
      <ar:DocTipo>${d.docTipo}</ar:DocTipo>
      <ar:DocNro>${d.docNro}</ar:DocNro>
      <ar:CbteDesde>${d.cbteDesde}</ar:CbteDesde>
      <ar:CbteHasta>${d.cbteHasta}</ar:CbteHasta>
      <ar:CbteFch>${d.cbteFch}</ar:CbteFch>
      <ar:ImpTotal>${d.impTotal}</ar:ImpTotal>
      <ar:ImpTotConc>${d.impTotConc}</ar:ImpTotConc>
      <ar:ImpNeto>${d.impNeto}</ar:ImpNeto>
      <ar:ImpOpEx>${d.impOpEx}</ar:ImpOpEx>
      <ar:ImpTrib>${d.impTrib}</ar:ImpTrib>
      <ar:ImpIVA>${d.impIVA}</ar:ImpIVA>
      <ar:MonId>${d.monId}</ar:MonId>
      <ar:MonCotiz>${d.monCotiz}</ar:MonCotiz>
      <ar:CondicionIVAReceptorId>${d.condicionIVAReceptorId}</ar:CondicionIVAReceptorId>
      ${ivaXml}${asocXml}
    </ar:FECAEDetRequest>`;
  }).join('');

  const body = `${buildAuthXml(token, sign, cuit)}
    <ar:FeCAEReq>
      <ar:FeCabReq><ar:CantReg>${cab.cantReg}</ar:CantReg><ar:PtoVta>${cab.ptoVta}</ar:PtoVta><ar:CbteTipo>${cab.cbteTipo}</ar:CbteTipo></ar:FeCabReq>
      <ar:FeDetReq>${detXml}</ar:FeDetReq>
    </ar:FeCAEReq>`;
  return buildWsfev1Envelope('FECAESolicitar', body);
}

// ─────────────────────────────────────────────────────────────────────────────────
// Encryption (AES-CBC, matching EncryptionService.cs / encryptionService.ts)
// ─────────────────────────────────────────────────────────────────────────────────

async function decryptString(encryptedBase64: string, secretKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const hash = await crypto.subtle.digest('SHA-256', keyData);
  const hashArray = new Uint8Array(hash);

  const key = await crypto.subtle.importKey('raw', hashArray, { name: 'AES-CBC' }, false, ['decrypt']);
  const iv = hashArray.slice(0, 16);

  // base64 → bytes
  const raw = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, raw);
  return new TextDecoder().decode(decrypted);
}

// ─────────────────────────────────────────────────────────────────────────────────
// CMS / PKCS#7 Signing (WSAA auth)
// ─────────────────────────────────────────────────────────────────────────────────

function signMessageCMS(message: string, certPem: string, keyPem: string): string {
  const cert = forge.pki.certificateFromPem(certPem);
  const privateKey = forge.pki.privateKeyFromPem(keyPem);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(message, 'utf8');
  p7.addCertificate(cert);
  p7.addSigner({
    key: privateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
    ],
  });
  p7.sign();

  const asn1 = p7.toAsn1();
  const der = forge.asn1.toDer(asn1);
  return forge.util.encode64(der.getBytes());
}

// ─────────────────────────────────────────────────────────────────────────────────
// WSAA Login
// ─────────────────────────────────────────────────────────────────────────────────

let _uniqueId = 0;

async function wsaaLogin(certPem: string, keyPem: string, environment: AfipEnvironment) {
  _uniqueId++;
  const xml = buildLoginTicketRequest('wsfe', _uniqueId);
  const signed = signMessageCMS(xml, certPem, keyPem);

  const url = environment === 'production'
    ? AFIP_ENDPOINTS.wsaa.production
    : AFIP_ENDPOINTS.wsaa.homologation;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': '' },
    body: buildWsaaLoginEnvelope(signed),
  });

  if (!resp.ok) throw new Error(`WSAA HTTP ${resp.status}: ${await resp.text()}`);
  const text = await resp.text();

  const fault = extractSoapFault(text);
  if (fault) throw new Error(`WSAA Fault: ${fault}`);

  let loginReturn = extractXmlValue(text, 'loginCmsReturn');
  if (!loginReturn) throw new Error('WSAA: loginCmsReturn not found');

  loginReturn = loginReturn
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

  const token = extractXmlValue(loginReturn, 'token');
  const sign = extractXmlValue(loginReturn, 'sign');
  const expStr = extractXmlValue(loginReturn, 'expirationTime');
  if (!token || !sign) throw new Error('WSAA: token/sign not found');

  return { token, sign, expirationTime: expStr ? new Date(expStr) : new Date() };
}

// ─────────────────────────────────────────────────────────────────────────────────
// WSFEv1 SOAP calls
// ─────────────────────────────────────────────────────────────────────────────────

async function wsfev1Call(url: string, action: string, envelope: string): Promise<string> {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': `${WSFEV1_NS}${action}` },
    body: envelope,
  });
  if (!resp.ok) throw new Error(`WSFEv1 HTTP ${resp.status}: ${await resp.text()}`);
  const text = await resp.text();
  const fault = extractSoapFault(text);
  if (fault) throw new Error(`WSFEv1 Fault: ${fault}`);
  return text;
}

function getWsfev1Url(env: AfipEnvironment): string {
  return env === 'production' ? AFIP_ENDPOINTS.wsfev1.production : AFIP_ENDPOINTS.wsfev1.homologation;
}

function parseErrors(xml: string) {
  const block = extractXmlBlock(xml, 'Errors');
  if (!block) return undefined;
  const errs = extractAllXmlBlocks(block, 'Err');
  if (!errs.length) return undefined;
  return errs.map(e => ({ code: extractXmlNumber(e, 'Code'), msg: extractXmlValue(e, 'Msg') || '' }));
}

function parseObs(xml: string) {
  const block = extractXmlBlock(xml, 'Observaciones');
  if (!block) return undefined;
  const obs = extractAllXmlBlocks(block, 'Obs');
  if (!obs.length) return undefined;
  return obs.map(o => ({ code: extractXmlNumber(o, 'Code'), msg: extractXmlValue(o, 'Msg') || '' }));
}

async function solicitarCAE(token: string, sign: string, cuit: number, req: FECAERequest, env: AfipEnvironment) {
  const url = getWsfev1Url(env);
  const envelope = buildFECAESolicitarEnvelope(token, sign, cuit, req.feCabReq, req.feDetReq);
  const xml = await wsfev1Call(url, 'FECAESolicitar', envelope);

  const result = extractXmlBlock(xml, 'FECAESolicitarResult');
  if (!result) throw new Error('FECAESolicitar: result not found');

  const cabBlock = extractXmlBlock(result, 'FeCabResp') || '';
  const feCabResp = {
    cuit: extractXmlNumber(cabBlock, 'Cuit'),
    ptoVta: extractXmlNumber(cabBlock, 'PtoVta'),
    cbteTipo: extractXmlNumber(cabBlock, 'CbteTipo'),
    fchProceso: extractXmlValue(cabBlock, 'FchProceso') || '',
    cantReg: extractXmlNumber(cabBlock, 'CantReg'),
    resultado: extractXmlValue(cabBlock, 'Resultado') || '',
    reproceso: extractXmlValue(cabBlock, 'Reproceso') || '',
  };

  const detBlock = extractXmlBlock(result, 'FeDetResp') || '';
  const detBlocks = extractAllXmlBlocks(detBlock, 'FECAEDetResponse');
  const feDetResp = detBlocks.map(b => ({
    concepto: extractXmlNumber(b, 'Concepto'),
    docTipo: extractXmlNumber(b, 'DocTipo'),
    docNro: extractXmlNumber(b, 'DocNro'),
    cbteDesde: extractXmlNumber(b, 'CbteDesde'),
    cbteHasta: extractXmlNumber(b, 'CbteHasta'),
    cbteFch: extractXmlValue(b, 'CbteFch') || '',
    resultado: extractXmlValue(b, 'Resultado') || '',
    cae: extractXmlValue(b, 'CAE') || '',
    caeFchVto: extractXmlValue(b, 'CAEFchVto') || '',
    observaciones: parseObs(b),
  }));

  return { feCabResp, feDetResp, errors: parseErrors(result) };
}

async function ultimoComprobante(token: string, sign: string, cuit: number, ptoVta: number, cbteTipo: number, env: AfipEnvironment) {
  const url = getWsfev1Url(env);
  const xml = await wsfev1Call(url, 'FECompUltimoAutorizado',
    buildFECompUltimoAutorizadoEnvelope(token, sign, cuit, ptoVta, cbteTipo));
  const result = extractXmlBlock(xml, 'FECompUltimoAutorizadoResult');
  if (!result) throw new Error('FECompUltimoAutorizado: result not found');
  return {
    cbteNro: extractXmlNumber(result, 'CbteNro'),
    errors: parseErrors(result),
  };
}

async function paramQuery(action: string, resultTag: string, itemTag: string,
  token: string, sign: string, cuit: number, env: AfipEnvironment) {
  const url = getWsfev1Url(env);
  const xml = await wsfev1Call(url, action,
    buildFEParamGetEnvelope(action, token, sign, cuit));
  const result = extractXmlBlock(xml, resultTag) || '';
  const items = extractAllXmlBlocks(result, itemTag);
  return items.map(b => ({
    id: extractXmlNumber(b, 'Id'),
    desc: extractXmlValue(b, 'Desc') || '',
    fchDesde: extractXmlValue(b, 'FchDesde') || '',
    fchHasta: extractXmlValue(b, 'FchHasta') || '',
  }));
}

async function verificarConexion(env: AfipEnvironment) {
  const url = getWsfev1Url(env);
  const xml = await wsfev1Call(url, 'FEDummy', buildFEDummyEnvelope());
  const result = extractXmlBlock(xml, 'FEDummyResult') || '';
  return {
    appServer: extractXmlValue(result, 'AppServer') || '',
    dbServer: extractXmlValue(result, 'DbServer') || '',
    authServer: extractXmlValue(result, 'AuthServer') || '',
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// Invoice builder helpers
// ─────────────────────────────────────────────────────────────────────────────────

function crearFacturaSimple(
  ptoVta: number, cbteNro: number, cbteTipo: number, fecha: string,
  concepto: number, docTipo: number, docNro: number,
  impTotal: number, impNeto: number, impIVA: number, impTrib: number,
  monId: string, monCotiz: number, iva: AlicIva[],
  condicionIVAReceptor: number
): FECAERequest {
  return {
    feCabReq: { cantReg: 1, ptoVta, cbteTipo },
    feDetReq: [{
      concepto, docTipo, docNro,
      cbteDesde: cbteNro, cbteHasta: cbteNro, cbteFch: fecha,
      impTotal, impNeto, impIVA, impOpEx: 0, impTotConc: 0, impTrib,
      monId, monCotiz, condicionIVAReceptorId: condicionIVAReceptor,
      iva,
    }],
  };
}

function crearNotaCredito(
  ptoVta: number, cbteNro: number, cbteTipo: number, fecha: string,
  tipoFacturaOrig: number, ptoVtaOrig: number, nroOrig: number,
  docTipo: number, docNro: number,
  impTotal: number, impNeto: number, impIVA: number, impTrib: number,
  monId: string, monCotiz: number, iva: AlicIva[],
  condicionIVAReceptor: number
): FECAERequest {
  return {
    feCabReq: { cantReg: 1, ptoVta, cbteTipo },
    feDetReq: [{
      concepto: 1, docTipo, docNro,
      cbteDesde: cbteNro, cbteHasta: cbteNro, cbteFch: fecha,
      impTotal, impNeto, impIVA, impOpEx: 0, impTotConc: 0, impTrib,
      monId, monCotiz, condicionIVAReceptorId: condicionIVAReceptor,
      iva,
      cbtesAsoc: [{ tipo: tipoFacturaOrig, ptoVta: ptoVtaOrig, nro: nroOrig }],
    }],
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// Main orchestration
// ─────────────────────────────────────────────────────────────────────────────────

function resolveEnv(ambiente: number): AfipEnvironment {
  return ambiente === 1 ? 'production' : 'homologation';
}

function isTokenValid(exp: string | null): boolean {
  if (!exp) return false;
  return new Date(exp) > new Date();
}

interface DbCustomer {
  cuit: string;
  token: string | null;
  sign: string | null;
  'expiracion_Token': string | null;
  certificado_encriptado: string;
  certificado_private_key_encriptada: string;
}

async function ensureLogin(
  supabase: ReturnType<typeof createClient>,
  cuit: string,
  environment: AfipEnvironment,
  encryptionKey: string
) {
  // Get customer with all needed fields
  const { data: customer, error } = await supabase
    .from('customers_afip')
    .select('cuit, token, sign, "expiracion_Token", certificado_encriptado, certificado_private_key_encriptada')
    .eq('cuit', cuit)
    .eq('estado', true)
    .single();

  if (error || !customer) {
    throw new Error(`Customer with CUIT ${cuit} not found or not enabled.`);
  }

  const c = customer as DbCustomer;

  // Check existing token
  if (c.token && c.sign && isTokenValid(c['expiracion_Token'])) {
    return { token: c.token, sign: c.sign };
  }

  // Decrypt certificate
  const certPem = await decryptString(c.certificado_encriptado, encryptionKey);
  const keyPem = await decryptString(c.certificado_private_key_encriptada, encryptionKey);

  // WSAA login
  console.log(`[AFIP] Performing WSAA login for CUIT ${cuit}`);
  const loginResult = await wsaaLogin(certPem, keyPem, environment);

  // Update token in DB
  const { error: updateError } = await supabase
    .from('customers_afip')
    .update({
      token: loginResult.token,
      sign: loginResult.sign,
      'expiracion_Token': loginResult.expirationTime.toISOString(),
      fecha_modificacion: new Date().toISOString(),
    })
    .eq('cuit', cuit);

  if (updateError) {
    console.error(`[AFIP] Failed to update token: ${updateError.message}`);
  }

  return { token: loginResult.token, sign: loginResult.sign };
}

async function handleGenerateInvoice(
  supabase: ReturnType<typeof createClient>,
  req: FacturaRequest,
  encryptionKey: string,
  isCreditNote = false
) {
  const environment = resolveEnv(req.ambiente);
  const cuitStr = req.cuit.toString();

  // 1. Login
  const auth = await ensureLogin(supabase, cuitStr, environment, encryptionKey);

  // 2. Get last voucher
  const ultimo = await ultimoComprobante(
    auth.token, auth.sign, req.cuit, req.puntoVenta, req.tipoComprobante, environment
  );
  if (ultimo.errors?.length) {
    throw new Error(`AFIP error: ${ultimo.errors.map(e => e.msg).join(', ')}`);
  }
  const nextNumber = ultimo.cbteNro + 1;

  // 3. Format date to YYYYMMDD (AFIP requirement)
  const fechaAfip = req.fechaComprobante.replace(/[-T:.\sZ]/g, '').slice(0, 8) ||
    new Date().toISOString().replace(/[-T:.\sZ]/g, '').slice(0, 8);

  // 4. Build IVA
  const ivaList: AlicIva[] = req.ivaList.map(i => ({
    id: i.id, baseImp: i.baseImponible, importe: i.importe,
  }));

  // Condicion IVA Receptor: default 5 (Consumidor Final) for Factura C
  const condIva = req.condicionIVAReceptorId || 5;
  const impTrib = req.impTrib ?? 0;

  // 5. Build request
  let factura: FECAERequest;
  if (isCreditNote) {
    factura = crearNotaCredito(
      req.puntoVenta, nextNumber, req.tipoComprobante, fechaAfip,
      req.tipoFacturaOriginal || 0, req.puntoDeVentaOriginal || 0, req.numeroFactura || 0,
      req.tipoDocCliente, req.dniCliente,
      req.importeTotal, req.importeNeto, req.importeIVA, impTrib,
      req.moneda, req.cotizacion, ivaList, condIva
    );
  } else {
    factura = crearFacturaSimple(
      req.puntoVenta, nextNumber, req.tipoComprobante, fechaAfip,
      req.tipoConcepto, req.tipoDocCliente, req.dniCliente,
      req.importeTotal, req.importeNeto, req.importeIVA, impTrib,
      req.moneda, req.cotizacion, ivaList, condIva
    );
    // Factura C: no IVA
    if (req.tipoComprobante === TipoComprobante_FacturaC) {
      factura.feDetReq[0].iva = null;
    }
  }

  // 5. Request CAE
  console.log(`[AFIP] Requesting CAE for CUIT ${req.cuit}, PtoVta ${req.puntoVenta}, CbteTipo ${req.tipoComprobante}, CbteNro ${nextNumber}`);
  const resp = await solicitarCAE(auth.token, auth.sign, req.cuit, factura, environment);
  console.log(`[AFIP] CAE Response: resultado=${resp.feCabResp.resultado}, errors=${JSON.stringify(resp.errors)}`);

  if (!resp.feDetResp?.length) {
    return {
      cae: '', caeFchVto: '',
      resultado: 'R',
      observacion: resp.errors?.map(e => `[${e.code}] ${e.msg}`).join(', ') || 'Sin respuesta de AFIP',
    };
  }

  // 6. Get voucher type description (non-critical)
  let tipoDesc = '';
  if (!isCreditNote) {
    try {
      const tipos = await paramQuery('FEParamGetTiposCbte', 'FEParamGetTiposCbteResult', 'CbteTipo',
        auth.token, auth.sign, req.cuit, environment);
      const found = tipos.find(t => t.id === resp.feCabResp.cbteTipo);
      if (found) tipoDesc = found.desc;
    } catch { /* non-critical */ }
  }

  const det = resp.feDetResp[0];
  const pv = String(resp.feCabResp.ptoVta).padStart(4, '0');
  const cn = String(det.cbteHasta).padStart(8, '0');

  // Collect ALL error/observation messages
  const messages: string[] = [];
  if (det.observaciones?.length) {
    messages.push(...det.observaciones.map((o: { code: number; msg: string }) => `[Obs ${o.code}] ${o.msg}`));
  }
  if (resp.errors?.length) {
    messages.push(...resp.errors.map(e => `[Err ${e.code}] ${e.msg}`));
  }
  const observacion = messages.join(' | ');

  console.log(`[AFIP] Detail: resultado=${det.resultado}, cae=${det.cae}, observacion=${observacion}`);

  return {
    cae: det.cae,
    caeFchVto: det.caeFchVto,
    resultado: det.resultado,
    observacion,
    comprobanteTipo: resp.feCabResp.cbteTipo,
    comprobanteNro: String(det.cbteHasta),
    comprobanteDescripcion: `${tipoDesc} ${pv}-${cn}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// Edge Function Handler
// ─────────────────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (request: Request) => {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await request.json();

    // Environment setup
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY') || '';

    // Create Supabase client with the user's JWT for RLS
    const authHeader = request.headers.get('Authorization');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader || '' } },
    });

    let result: unknown;

    switch (action) {
      case 'generate-invoice': {
        result = await handleGenerateInvoice(supabase, params as FacturaRequest, encryptionKey, false);
        break;
      }

      case 'generate-credit-note': {
        result = await handleGenerateInvoice(supabase, params as FacturaRequest, encryptionKey, true);
        break;
      }

      case 'check-connection': {
        const env = resolveEnv(params.ambiente ?? 2);
        result = await verificarConexion(env);
        break;
      }

      case 'get-tipos-documento': {
        const env = resolveEnv(params.ambiente ?? 2);
        const auth = await ensureLogin(supabase, String(params.cuit), env, encryptionKey);
        result = await paramQuery('FEParamGetTiposDoc', 'FEParamGetTiposDocResult', 'DocTipo',
          auth.token, auth.sign, params.cuit, env);
        break;
      }

      case 'get-tipos-comprobante': {
        const env = resolveEnv(params.ambiente ?? 2);
        const auth = await ensureLogin(supabase, String(params.cuit), env, encryptionKey);
        result = await paramQuery('FEParamGetTiposCbte', 'FEParamGetTiposCbteResult', 'CbteTipo',
          auth.token, auth.sign, params.cuit, env);
        break;
      }

      case 'get-tipos-concepto': {
        const env = resolveEnv(params.ambiente ?? 2);
        const auth = await ensureLogin(supabase, String(params.cuit), env, encryptionKey);
        result = await paramQuery('FEParamGetTiposConcepto', 'FEParamGetTiposConceptoResult', 'ConceptoTipo',
          auth.token, auth.sign, params.cuit, env);
        break;
      }

      case 'get-condicion-iva': {
        const env = resolveEnv(params.ambiente ?? 2);
        const auth = await ensureLogin(supabase, String(params.cuit), env, encryptionKey);
        result = await paramQuery('FEParamGetCondicionIvaReceptor', 'FEParamGetCondicionIvaReceptorResult', 'CondicionIvaReceptor',
          auth.token, auth.sign, params.cuit, env);
        break;
      }

      case 'get-tipos-tributo': {
        const env = resolveEnv(params.ambiente ?? 2);
        const auth = await ensureLogin(supabase, String(params.cuit), env, encryptionKey);
        result = await paramQuery('FEParamGetTiposTributos', 'FEParamGetTiposTributosResult', 'TributoTipo',
          auth.token, auth.sign, params.cuit, env);
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ data: result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[AFIP Edge Function] Error: ${msg}`);
    return new Response(JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
