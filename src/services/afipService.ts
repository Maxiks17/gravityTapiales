/**
 * AFIP Service - Frontend interface for AFIP operations
 *
 * Calls the Supabase Edge Function "afip" which handles all server-side
 * AFIP SOAP communication (WSAA login + WSFEv1 invoicing).
 * This avoids CORS issues since AFIP endpoints don't allow browser requests.
 */

import { supabase } from './supabaseClient';

const supabaseUrl = import.meta.env.SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

// ─── Re-export types ─────────────────────────────────────────────────────────────

export type { FacturaRequest, FacturaResponse } from './afip/types';
export type { CustomerAfipResponse, AlicIvaDto } from './afip/types';

// ─── Response Interfaces (backward-compatible with the old .NET API responses) ───

export interface AuthHealthResponse {
    health: boolean;
}

export interface AfipParametroItem {
    id: number;
    desc: string;
    fchDesde?: string;
    fchHasta?: string;
}

export interface GenerateInvoiceResponse {
    mensaje: string;
    response: InvoiceResponseDetail;
}

interface InvoiceResponseDetail {
    cae: string;
    caeFchVto: string;
    comprobanteDescripcion: string;
    comprobanteNro: number;
    comprobanteTipo: number;
    observacion: string;
    resultado: string;
}

export interface InvoicePayload {
    ambiente: number;
    cuit: number;
    puntoVenta: number;
    numeroComprobante: number;
    tipoComprobante: number;
    tipoConcepto: number;
    tipoDocCliente: number;
    dniCliente: string | number;
    importeTotal: number;
    importeNeto: number;
    importeIVA: number;
    importeTributo?: number;
    moneda: string;
    cotizacion: number;
    ivaList: {
        id: number;
        baseImponible: number;
        importe: number;
    }[];
    fechaComprobante: string;
    puntoDeVentaOriginal: number;
    // Credit note fields
    numeroFactura?: number;
    tipoFacturaOriginal?: number;
    fechaFacturaOriginal?: string;
}

// ─── Edge Function Helper ────────────────────────────────────────────────────────

async function callAfipFunction<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    const invokeWithToken = async (token: string | null) => {
        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error('Configuracion de Supabase incompleta (URL o ANON KEY).');
        }
        if (!token) {
            throw new Error('Sesion expirada. Inicia sesion nuevamente para facturar.');
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/afip`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: supabaseAnonKey,
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ action, ...params }),
        });

        let payload: { data?: unknown; error?: string } | null = null;
        try {
            payload = await response.json();
        } catch {
            // Keep payload as null when body is not valid JSON.
        }

        if (!response.ok) {
            const msg = payload?.error || `Edge Function HTTP ${response.status}`;
            throw new Error(msg);
        }

        return payload;
    };

    const { data: sessionData } = await supabase.auth.getSession();
    let token = sessionData.session?.access_token ?? null;

    if (!token) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshed.session?.access_token) {
            throw new Error('Sesion expirada. Inicia sesion nuevamente para facturar.');
        }
        token = refreshed.session.access_token;
    }

    let data: { data?: unknown; error?: string } | null;
    try {
        data = await invokeWithToken(token);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const isUnauthorized = msg.includes('HTTP 401') || msg.toLowerCase().includes('unauthorized');

        if (!isUnauthorized) {
            throw error;
        }

        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshed.session?.access_token) {
            throw new Error('Sesion expirada. Inicia sesion nuevamente para facturar.');
        }

        data = await invokeWithToken(refreshed.session.access_token);
    }

    if (data?.error) {
        throw new Error(data.error);
    }

    return data?.data as T;
}

// ─── API Methods ─────────────────────────────────────────────────────────────────

/**
 * Check AFIP WSFEv1 connection
 */
export async function checkAuthHealth(): Promise<AuthHealthResponse> {
    try {
        const result = await callAfipFunction<{ appServer: string; dbServer: string; authServer: string }>(
            'check-connection', { ambiente: 2 }
        );
        return {
            health: result.appServer === 'OK' && result.dbServer === 'OK' && result.authServer === 'OK',
        };
    } catch {
        return { health: false };
    }
}

/**
 * Get AFIP tributo types (FEParamGetTiposTributos)
 */
export async function getTiposTributo(cuit: number, ambiente: number): Promise<AfipParametroItem[]> {
    return callAfipFunction<AfipParametroItem[]>('get-tipos-tributo', { cuit, ambiente });
}

/**
 * Generate an invoice via the AFIP Edge Function
 */
export async function generateInvoice(payload: InvoicePayload): Promise<GenerateInvoiceResponse> {
    const result = await callAfipFunction<{
        cae: string;
        caeFchVto: string;
        resultado: string;
        observacion: string;
        comprobanteDescripcion?: string;
        comprobanteNro?: string;
        comprobanteTipo?: number;
    }>('generate-invoice', {
        ambiente: payload.ambiente,
        cuit: payload.cuit,
        puntoVenta: payload.puntoVenta,
        tipoComprobante: payload.tipoComprobante,
        tipoConcepto: payload.tipoConcepto,
        tipoDocCliente: payload.tipoDocCliente,
        dniCliente: payload.dniCliente,
        importeTotal: payload.importeTotal,
        importeNeto: payload.importeNeto,
        importeIVA: payload.importeIVA,
        impTrib: payload.importeTributo,
        moneda: payload.moneda,
        cotizacion: payload.cotizacion,
        ivaList: payload.ivaList,
        fechaComprobante: payload.fechaComprobante,
        puntoDeVentaOriginal: payload.puntoDeVentaOriginal,
        numeroFactura: payload.numeroFactura,
        tipoFacturaOriginal: payload.tipoFacturaOriginal,
    });

    return {
        mensaje: result.resultado === 'A' ? 'Factura generada exitosamente' : 'Error al generar factura',
        response: {
            cae: result.cae,
            caeFchVto: result.caeFchVto,
            comprobanteDescripcion: result.comprobanteDescripcion || '',
            comprobanteNro: Number(result.comprobanteNro) || 0,
            comprobanteTipo: result.comprobanteTipo || 0,
            observacion: result.observacion,
            resultado: result.resultado,
        },
    };
}

/**
 * Generate a credit note via the AFIP Edge Function
 */
export async function generateCreditNote(payload: InvoicePayload): Promise<GenerateInvoiceResponse> {
    const impTrib = Number(((payload.importeTributo ?? (payload.importeTotal - payload.importeNeto)) || 0).toFixed(2));

    const objNota = {
        ambiente: payload.ambiente,
        cuit: payload.cuit,
        puntoVenta: payload.puntoVenta,
        tipoComprobante: payload.tipoComprobante,
        tipoConcepto: payload.tipoConcepto,
        tipoDocCliente: payload.tipoDocCliente,
        dniCliente: payload.dniCliente,
        importeTotal: payload.importeTotal,
        importeNeto: payload.importeNeto,
        importeIVA: payload.importeIVA,         
        impTrib,
        moneda: payload.moneda,
        cotizacion: payload.cotizacion,
        ivaList: payload.ivaList,
        fechaComprobante: payload.fechaComprobante,
        puntoDeVentaOriginal: payload.puntoDeVentaOriginal,
        numeroFactura: payload.numeroFactura,
        tipoFacturaOriginal: payload.tipoFacturaOriginal,
        cbtesAsoc: {
            tipo: payload.tipoFacturaOriginal,
            ptoVta: payload.puntoDeVentaOriginal,
            nro: payload.numeroFactura,
            cuit: payload.cuit,
            cbteFch: payload.fechaFacturaOriginal
        }
    }
    console.log('Generating credit note with object:', objNota);

    const result = await callAfipFunction<{
        cae: string;
        caeFchVto: string;
        resultado: string;
        observacion: string;
        comprobanteDescripcion?: string;
        comprobanteNro?: string;
        comprobanteTipo?: number;
    }>('generate-credit-note', objNota );

    return {
        mensaje: result.resultado === 'A' ? 'Nota de crédito generada exitosamente' : 'Error al generar nota de crédito',
        response: {
            cae: result.cae,
            caeFchVto: result.caeFchVto,
            comprobanteDescripcion: result.comprobanteDescripcion || '',
            comprobanteNro: Number(result.comprobanteNro) || 0,
            comprobanteTipo: result.comprobanteTipo || 0,
            observacion: result.observacion,
            resultado: result.resultado,
        },
    };
}

// Export default service object for convenience
export default {
    checkAuthHealth,
    getTiposTributo,
    generateInvoice,
    generateCreditNote,
};
