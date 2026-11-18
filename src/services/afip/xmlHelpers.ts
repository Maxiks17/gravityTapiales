/**
 * XML Helpers - Simple XML building and parsing utilities for AFIP SOAP communication
 * No external dependencies - uses regex for parsing well-structured SOAP responses
 */

/**
 * Extract the text content of an XML element by tag name
 * Works for simple non-nested elements: <Tag>value</Tag>
 */
export function extractXmlValue(xml: string, tag: string): string | null {
  const regex = new RegExp(`<(?:[\\w]+:)?${tag}[^>]*>([^<]*)</(?:[\\w]+:)?${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Extract the full inner content of an XML block (may contain nested elements)
 */
export function extractXmlBlock(xml: string, tag: string): string | null {
  const regex = new RegExp(`<(?:[\\w]+:)?${tag}[^>]*>(.*?)</(?:[\\w]+:)?${tag}>`, 'is');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Extract all occurrences of an XML block
 */
export function extractAllXmlBlocks(xml: string, tag: string): string[] {
  const regex = new RegExp(`<(?:[\\w]+:)?${tag}[^>]*>(.*?)</(?:[\\w]+:)?${tag}>`, 'gis');
  return [...xml.matchAll(regex)].map(m => m[1].trim());
}

/**
 * Extract numeric value from XML
 */
export function extractXmlNumber(xml: string, tag: string): number {
  const val = extractXmlValue(xml, tag);
  return val ? Number(val) : 0;
}

/**
 * Check if a SOAP response contains a fault
 */
export function extractSoapFault(xml: string): string | null {
  const faultString = extractXmlValue(xml, 'faultstring');
  return faultString || null;
}

/**
 * Build a SOAP 1.1 envelope for WSAA loginCms
 */
export function buildWsaaLoginEnvelope(signedCmsBase64: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soap:Body>
    <wsaa:loginCms>
      <wsaa:in0>${signedCmsBase64}</wsaa:in0>
    </wsaa:loginCms>
  </soap:Body>
</soap:Envelope>`;
}

/**
 * Build an AFIP LoginTicketRequest XML
 */
export function buildLoginTicketRequest(service: string, uniqueId: number): string {
  const now = new Date();
  const generationTime = new Date(now.getTime() - 10 * 60 * 1000); // -10 minutes
  const expirationTime = new Date(now.getTime() + 10 * 60 * 1000); // +10 minutes

  const formatDate = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, '');

  return `<loginTicketRequest><header><uniqueId>${uniqueId}</uniqueId><generationTime>${formatDate(generationTime)}</generationTime><expirationTime>${formatDate(expirationTime)}</expirationTime></header><service>${service}</service></loginTicketRequest>`;
}

/**
 * Build WSFEv1 Auth XML block
 */
function buildAuthXml(token: string, sign: string, cuit: number): string {
  return `<ar:Auth>
        <ar:Token>${token}</ar:Token>
        <ar:Sign>${sign}</ar:Sign>
        <ar:Cuit>${cuit}</ar:Cuit>
      </ar:Auth>`;
}

/**
 * Build a SOAP 1.1 envelope for WSFEv1 operations
 */
export function buildWsfev1Envelope(action: string, bodyContent: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soap:Body>
    <ar:${action}>
      ${bodyContent}
    </ar:${action}>
  </soap:Body>
</soap:Envelope>`;
}

/**
 * Build FECAESolicitar SOAP envelope
 */
export function buildFECAESolicitarEnvelope(
  token: string,
  sign: string,
  cuit: number,
  cabecera: { cantReg: number; ptoVta: number; cbteTipo: number },
  detalles: Array<{
    concepto: number;
    docTipo: number;
    docNro: number;
    cbteDesde: number;
    cbteHasta: number;
    cbteFch: string;
    impTotal: number;
    impTotConc: number;
    impNeto: number;
    impOpEx: number;
    impTrib: number;
    impIVA: number;
    monId: string;
    monCotiz: number;
    condicionIVAReceptorId?: number;
    fchServDesde?: string;
    fchServHasta?: string;
    fchVtoPago?: string;
    iva: Array<{ id: number; baseImp: number; importe: number }> | null;
    tributos?: Array<{ id: number; desc: string; baseImp: number; alic: number; importe: number }>;
    cbtesAsoc?: Array<{ tipo: number; ptoVta: number; nro: number; cuit?: string; cbteFch?: string }>;
    opcionales?: Array<{ id: string; valor: string }>;
  }>
): string {
  const auth = buildAuthXml(token, sign, cuit);

  const detallesXml = detalles.map(d => {
    let ivaXml = '';
    if (d.iva && d.iva.length > 0) {
      const alicuotasXml = d.iva.map(i =>
        `<ar:AlicIva>
                    <ar:Id>${i.id}</ar:Id>
                    <ar:BaseImp>${i.baseImp}</ar:BaseImp>
                    <ar:Importe>${i.importe}</ar:Importe>
                  </ar:AlicIva>`
      ).join('\n');
      ivaXml = `<ar:Iva>${alicuotasXml}</ar:Iva>`;
    }

    let tributosXml = '';
    if (d.tributos && d.tributos.length > 0) {
      const tribItems = d.tributos.map(t =>
        `<ar:Tributo>
                    <ar:Id>${t.id}</ar:Id>
                    <ar:Desc>${t.desc}</ar:Desc>
                    <ar:BaseImp>${t.baseImp}</ar:BaseImp>
                    <ar:Alic>${t.alic}</ar:Alic>
                    <ar:Importe>${t.importe}</ar:Importe>
                  </ar:Tributo>`
      ).join('\n');
      tributosXml = `<ar:Tributos>${tribItems}</ar:Tributos>`;
    }

    let cbtesAsocXml = '';
    if (d.cbtesAsoc && d.cbtesAsoc.length > 0) {
      const asocItems = d.cbtesAsoc.map(a => {
        let inner = `<ar:Tipo>${a.tipo}</ar:Tipo>
                    <ar:PtoVta>${a.ptoVta}</ar:PtoVta>
                    <ar:Nro>${a.nro}</ar:Nro>`;
        if (a.cuit) inner += `\n                    <ar:Cuit>${a.cuit}</ar:Cuit>`;
        if (a.cbteFch) inner += `\n                    <ar:CbteFch>${a.cbteFch}</ar:CbteFch>`;
        return `<ar:CbteAsoc>${inner}</ar:CbteAsoc>`;
      }).join('\n');
      cbtesAsocXml = `<ar:CbtesAsoc>${asocItems}</ar:CbtesAsoc>`;
    }

    let opcionalesXml = '';
    if (d.opcionales && d.opcionales.length > 0) {
      const opcItems = d.opcionales.map(o =>
        `<ar:Opcional>
                    <ar:Id>${o.id}</ar:Id>
                    <ar:Valor>${o.valor}</ar:Valor>
                  </ar:Opcional>`
      ).join('\n');
      opcionalesXml = `<ar:Opcionales>${opcItems}</ar:Opcionales>`;
    }

    let serviceDatesXml = '';
    if (d.fchServDesde) serviceDatesXml += `\n                <ar:FchServDesde>${d.fchServDesde}</ar:FchServDesde>`;
    if (d.fchServHasta) serviceDatesXml += `\n                <ar:FchServHasta>${d.fchServHasta}</ar:FchServHasta>`;
    if (d.fchVtoPago) serviceDatesXml += `\n                <ar:FchVtoPago>${d.fchVtoPago}</ar:FchVtoPago>`;

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
                <ar:MonCotiz>${d.monCotiz}</ar:MonCotiz>${serviceDatesXml}
                ${d.condicionIVAReceptorId ? `<ar:CondicionIVAReceptorId>${d.condicionIVAReceptorId}</ar:CondicionIVAReceptorId>` : ''}
                ${ivaXml}
                ${tributosXml}
                ${cbtesAsocXml}
                ${opcionalesXml}
              </ar:FECAEDetRequest>`;
  }).join('\n');

  const body = `${auth}
      <ar:FeCAEReq>
        <ar:FeCabReq>
          <ar:CantReg>${cabecera.cantReg}</ar:CantReg>
          <ar:PtoVta>${cabecera.ptoVta}</ar:PtoVta>
          <ar:CbteTipo>${cabecera.cbteTipo}</ar:CbteTipo>
        </ar:FeCabReq>
        <ar:FeDetReq>
          ${detallesXml}
        </ar:FeDetReq>
      </ar:FeCAEReq>`;

  return buildWsfev1Envelope('FECAESolicitar', body);
}

/**
 * Build FECompUltimoAutorizado SOAP envelope
 */
export function buildFECompUltimoAutorizadoEnvelope(
  token: string,
  sign: string,
  cuit: number,
  ptoVta: number,
  cbteTipo: number
): string {
  const body = `${buildAuthXml(token, sign, cuit)}
      <ar:PtoVta>${ptoVta}</ar:PtoVta>
      <ar:CbteTipo>${cbteTipo}</ar:CbteTipo>`;
  return buildWsfev1Envelope('FECompUltimoAutorizado', body);
}

/**
 * Build FEParamGet* SOAP envelope (for parameter queries)
 */
export function buildFEParamGetEnvelope(
  action: string,
  token: string,
  sign: string,
  cuit: number,
  extraParams?: string
): string {
  let body = buildAuthXml(token, sign, cuit);
  if (extraParams) body += `\n      ${extraParams}`;
  return buildWsfev1Envelope(action, body);
}

/**
 * Build FEDummy SOAP envelope (connection test)
 */
export function buildFEDummyEnvelope(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soap:Body>
    <ar:FEDummy />
  </soap:Body>
</soap:Envelope>`;
}

/**
 * Build FECompConsultar SOAP envelope
 */
export function buildFECompConsultarEnvelope(
  token: string,
  sign: string,
  cuit: number,
  cbteTipo: number,
  cbteNro: number,
  ptoVta: number
): string {
  const body = `${buildAuthXml(token, sign, cuit)}
      <ar:FeCompConsReq>
        <ar:CbteTipo>${cbteTipo}</ar:CbteTipo>
        <ar:CbteNro>${cbteNro}</ar:CbteNro>
        <ar:PtoVta>${ptoVta}</ar:PtoVta>
      </ar:FeCompConsReq>`;
  return buildWsfev1Envelope('FECompConsultar', body);
}
