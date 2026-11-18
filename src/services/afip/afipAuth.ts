/**
 * AFIP Auth Service - WSAA Authentication
 * Ported from afip_login (.NET) - LoginTicket + CertificadosX509Lib
 *
 * Handles:
 * 1. Building LoginTicketRequest XML
 * 2. Signing with CMS/PKCS#7 using X509 certificate (node-forge)
 * 3. Calling WSAA SOAP service to obtain token/sign
 * 4. Parsing the login response
 *
 * NOTE: This module requires server-side execution (Node.js / Edge Function / Serverless)
 * because AFIP SOAP services do not support CORS for browser-based requests.
 */

import forge from 'node-forge';
import { AFIP_ENDPOINTS } from './constants';
import { buildLoginTicketRequest, buildWsaaLoginEnvelope, extractXmlValue, extractSoapFault } from './xmlHelpers';
import type { AfipEnvironment, AfipLoginResult } from './types';

let _globalUniqueId = 0;

/**
 * Sign a message using CMS/PKCS#7 with an X509 certificate
 * Equivalent to CertificadosX509Lib.FirmaBytesMensaje in .NET
 *
 * @param message - The message string to sign (XML LoginTicketRequest)
 * @param certPem - Certificate in PEM format
 * @param keyPem - Private key in PEM format
 * @returns Base64-encoded CMS signed data
 */
export function signMessageCMS(message: string, certPem: string, keyPem: string): string {
  try {
    const cert = forge.pki.certificateFromPem(certPem);
    const privateKey = forge.pki.privateKeyFromPem(keyPem);

    // Create PKCS#7 signed data (equivalent to .NET's SignedCms)
    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(message, 'utf8');
    p7.addCertificate(cert);
    p7.addSigner({
      key: privateKey,
      certificate: cert,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        {
          type: forge.pki.oids.contentType,
          value: forge.pki.oids.data,
        },
        {
          type: forge.pki.oids.messageDigest,
          // value will be auto-calculated
        },
        {
          type: forge.pki.oids.signingTime,
          // node-forge handles Date at runtime; cast needed due to strict type defs
          value: new Date() as unknown as string,
        },
      ],
    });

    p7.sign();

    // Encode to DER then Base64
    const asn1 = p7.toAsn1();
    const der = forge.asn1.toDer(asn1);
    return forge.util.encode64(der.getBytes());
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Error signing LoginTicketRequest (CMS): ${msg}`);
  }
}

/**
 * Call WSAA SOAP service to perform login
 *
 * @param wsaaUrl - WSAA endpoint URL
 * @param signedCmsBase64 - Base64-encoded CMS signed LoginTicketRequest
 * @returns The loginCmsReturn XML string
 */
async function callWsaaLogin(wsaaUrl: string, signedCmsBase64: string): Promise<string> {
  const soapEnvelope = buildWsaaLoginEnvelope(signedCmsBase64);

  const response = await fetch(wsaaUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': '',
    },
    body: soapEnvelope,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WSAA HTTP error ${response.status}: ${errorText}`);
  }

  const responseText = await response.text();

  // Check for SOAP fault
  const fault = extractSoapFault(responseText);
  if (fault) {
    throw new Error(`WSAA SOAP Fault: ${fault}`);
  }

  // Extract loginCmsReturn from SOAP response
  const loginCmsReturn = extractXmlValue(responseText, 'loginCmsReturn');
  if (!loginCmsReturn) {
    throw new Error('Invalid WSAA response: loginCmsReturn not found');
  }

  // The response may be HTML-encoded (< >) - decode it
  return loginCmsReturn
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Parse the LoginTicketResponse XML to extract credentials
 */
function parseLoginTicketResponse(xmlResponse: string): AfipLoginResult {
  const token = extractXmlValue(xmlResponse, 'token');
  const sign = extractXmlValue(xmlResponse, 'sign');
  const generationTimeStr = extractXmlValue(xmlResponse, 'generationTime');
  const expirationTimeStr = extractXmlValue(xmlResponse, 'expirationTime');

  if (!token || !sign) {
    throw new Error('Invalid LoginTicketResponse: token or sign not found');
  }

  return {
    token,
    sign,
    generationTime: generationTimeStr ? new Date(generationTimeStr) : new Date(),
    expirationTime: expirationTimeStr ? new Date(expirationTimeStr) : new Date(),
  };
}

/**
 * Obtain a Login Ticket from AFIP WSAA
 * Full authentication flow: build request → sign → call WSAA → parse response
 *
 * Equivalent to LoginTicket.ObtenerLoginTicketResponseAsync in .NET
 *
 * @param service - AFIP service to authenticate against (e.g., 'wsfe')
 * @param certPem - Certificate PEM content
 * @param keyPem - Private key PEM content
 * @param environment - 'production' or 'homologation'
 * @returns Login result with token, sign, and expiration
 */
export async function obtenerLoginTicket(
  service: string,
  certPem: string,
  keyPem: string,
  environment: AfipEnvironment
): Promise<AfipLoginResult> {
  // Step 1: Build LoginTicketRequest XML
  _globalUniqueId += 1;
  const loginTicketRequestXml = buildLoginTicketRequest(service, _globalUniqueId);

  console.log(`[AFIP Auth] Building login ticket for service: ${service}, environment: ${environment}`);

  // Step 2: Sign the LoginTicketRequest with CMS/PKCS#7
  const signedCmsBase64 = signMessageCMS(loginTicketRequestXml, certPem, keyPem);

  // Step 3: Call WSAA SOAP service
  const wsaaUrl = environment === 'production'
    ? AFIP_ENDPOINTS.wsaa.production
    : AFIP_ENDPOINTS.wsaa.homologation;

  console.log(`[AFIP Auth] Calling WSAA at: ${wsaaUrl}`);

  const loginResponse = await callWsaaLogin(wsaaUrl, signedCmsBase64);

  // Step 4: Parse response
  const result = parseLoginTicketResponse(loginResponse);

  console.log(`[AFIP Auth] Login successful. Token expires: ${result.expirationTime.toISOString()}`);

  return result;
}

/**
 * Check if a token is still valid (not expired)
 */
export function isTokenValid(expirationTime: Date | string | null): boolean {
  if (!expirationTime) return false;

  const expDate = typeof expirationTime === 'string' ? new Date(expirationTime) : expirationTime;
  return expDate > new Date();
}
