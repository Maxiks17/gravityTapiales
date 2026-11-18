import { supabase } from './supabaseClient';
import type { PaginationResponse } from '../hooks/useServerPagination';

export interface FiscalDocument {
    id: string;
    fdoc_number: string;
    customer_id: string;
    order_id?: string;
    fdoc_date: string;
    due_date?: string;
    status: 'pending' | 'paid' | 'overdue' | 'cancelled' | 'Aprobada';
    total_amount: number;
    cae?: string;
    cae_expiration_date?: string;
    punto_de_venta?: number;
    tipo_comprobante?: number;
    numero_comprobante?: number;
    customer?: {
        business_name: string;
    };
}

export interface FiscalDocumentOrderItem {
    id: string;
    quantity?: number;
    unit_price?: number;
    subtotal?: number;
    tax_rate?: number;
    product?: {
        id?: string;
        name?: string;
        tax_rate?: number;
        sale_price?: number;
    };
}

export interface FiscalDocumentTaxDetail {
    id: string;
    fiscal_document_id: string;
    order_item_id?: string | null;
    product_id?: string | null;
    product_name?: string | null;
    quantity?: number;
    unit_price?: number;
    line_subtotal?: number;
    line_total?: number;
    tax_rate_type_id?: number | null;
    tax_percentage: number;
    base_amount: number;
    tax_amount: number;
    total_amount: number;
}

export interface FiscalDocumentTaxDetailInput {
    order_item_id?: string | null;
    product_id?: string | null;
    product_name?: string | null;
    quantity?: number;
    unit_price?: number;
    line_subtotal?: number;
    line_total?: number;
    tax_rate_type_id?: number | null;
    tax_percentage?: number;
    base_amount: number;
    tax_amount: number;
    total_amount?: number;
}

export interface FiscalDocumentDetail extends FiscalDocument {
    customer?: {
        business_name: string;
        contact_name?: string;
        email?: string;
        phone?: string;
        document_type?: number;
        document_number?: string;
        address?: string;
    };
    order?: {
        id: string;
        order_number?: string;
        items?: FiscalDocumentOrderItem[];
    };
    tax_details?: FiscalDocumentTaxDetail[];
}

export interface FiscalDocumentFilters {
    dateMode?: 'exact' | 'range';
    exactDate?: string;
    dateFrom?: string;
    dateTo?: string;
    customerId?: string;
    documentType?: 'all' | 'invoice' | 'credit_note';
    puntoVenta?: number;
    tipoComprobante?: number;
    invoiceNumber?: string;
}

export interface FiscalDocumentReportFilters {
    dateFrom?: string;
    dateTo?: string;
    customerId?: string;
    documentType?: 'all' | 'invoice' | 'credit_note';
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const parsePercentFromNombre = (nombre: unknown) => {
    const match = String(nombre ?? '').match(/(\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : 0;
};

async function getTaxRatePercentById(): Promise<Map<number, number>> {
    const { data, error } = await supabase
        .from('tax_rate_types')
        .select('id, nombre');

    if (error) throw error;

    const map = new Map<number, number>();
    for (const item of data || []) {
        map.set(Number(item.id), parsePercentFromNombre(item.nombre));
    }
    return map;
}

async function buildTaxDetailsFromOrder(orderId?: string): Promise<FiscalDocumentTaxDetailInput[]> {
    if (!orderId) return [];

    const { data: orderItems, error } = await supabase
        .from('order_items')
        .select('id, product_id, quantity, unit_price, subtotal, tax_rate, product:products(name, tax_rate)')
        .eq('order_id', orderId);

    if (error) throw error;
    if (!orderItems || orderItems.length === 0) return [];

    const taxRatePercentById = await getTaxRatePercentById();
    const details: FiscalDocumentTaxDetailInput[] = [];

    for (const item of orderItems as Array<{
        id?: string;
        product_id?: string;
        quantity?: number;
        unit_price?: number;
        subtotal?: number;
        tax_rate?: number;
        product?: { name?: string; tax_rate?: number };
    }>) {
        const quantity = Number(item.quantity ?? 0);
        const unitPrice = Number(item.unit_price ?? 0);
        const lineTotal = quantity * unitPrice;
        if (lineTotal <= 0) continue;

        const rawRate = Number(item.product?.tax_rate ?? item.tax_rate ?? 0);
        const mappedPercent = taxRatePercentById.get(rawRate);
        const taxRateTypeId = mappedPercent !== undefined ? rawRate : null;
        const taxPercentage = mappedPercent ?? (rawRate > 0 && rawRate <= 100 ? rawRate : 0);

        const rawSubtotal = Number(item.subtotal ?? 0);
        const baseAmount = rawSubtotal > 0 && rawSubtotal <= lineTotal
            ? rawSubtotal
            : (taxPercentage > 0 ? lineTotal / (1 + taxPercentage / 100) : lineTotal);

        const taxAmount = Math.max(lineTotal - baseAmount, 0);

        details.push({
            order_item_id: item.id ?? null,
            product_id: item.product_id ?? null,
            product_name: item.product?.name ?? null,
            quantity: round2(quantity),
            unit_price: round2(unitPrice),
            line_subtotal: round2(baseAmount),
            line_total: round2(lineTotal),
            tax_rate_type_id: taxRateTypeId,
            tax_percentage: taxPercentage,
            base_amount: round2(baseAmount),
            tax_amount: round2(taxAmount),
            total_amount: round2(lineTotal),
        });
    }

    return details;
}

async function saveTaxDetails(
    fiscalDocumentId: string,
    taxDetails: FiscalDocumentTaxDetailInput[]
) {
    const { error: deleteError } = await supabase
        .from('fiscal_documents_detail')
        .delete()
        .eq('fiscal_document_id', fiscalDocumentId);

    if (deleteError) throw deleteError;

    if (taxDetails.length === 0) return;

    const rows = taxDetails.map((detail) => ({
        fiscal_document_id: fiscalDocumentId,
        order_item_id: detail.order_item_id ?? null,
        product_id: detail.product_id ?? null,
        product_name: detail.product_name ?? null,
        quantity: round2(Number(detail.quantity ?? 0)),
        unit_price: round2(Number(detail.unit_price ?? 0)),
        line_subtotal: round2(Number(detail.line_subtotal ?? detail.base_amount ?? 0)),
        line_total: round2(Number(detail.line_total ?? detail.total_amount ?? (Number(detail.base_amount ?? 0) + Number(detail.tax_amount ?? 0)))),
        tax_rate_type_id: detail.tax_rate_type_id ?? null,
        tax_percentage: Number(detail.tax_percentage ?? 0),
        base_amount: round2(Number(detail.base_amount ?? 0)),
        tax_amount: round2(Number(detail.tax_amount ?? 0)),
        total_amount: round2(Number(detail.total_amount ?? (Number(detail.base_amount ?? 0) + Number(detail.tax_amount ?? 0)))),
    }));

    const { error: insertError } = await supabase
        .from('fiscal_documents_detail')
        .insert(rows);

    if (insertError) throw insertError;
}

interface FiscalDocumentReportRow {
    id: string;
    fdoc_number: string;
    fdoc_date: string;
    total_amount: number;
    cae?: string;
    cae_expiration_date?: string;
    customer?: {
        business_name?: string;
        document_type?: number;
        document_number?: string;
    };
    tax_details?: Array<{
        tax_percentage?: number;
        base_amount?: number;
        tax_amount?: number;
        total_amount?: number;
    }>;
}

const toYmd = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
};

const onlyDigits = (value?: string) => (value || '').replace(/\D/g, '');

const mapPercentToAlicuotaId = (percent: number) => {
    const normalized = Number(percent || 0);
    if (normalized === 0) return 3;
    if (normalized === 2.5) return 9;
    if (normalized === 5) return 8;
    if (normalized === 10.5) return 4;
    if (normalized === 21) return 5;
    if (normalized === 27) return 6;
    return 5;
};

const parseVoucherData = (fdocNumber: string) => {
    const isCreditNote = /NC/i.test(fdocNumber);
    const tipoComprobante = isCreditNote ? 13 : 11;

    const pvNroMatch = fdocNumber.match(/(\d{1,5})[-\s](\d{1,8})/);
    const puntoVenta = pvNroMatch ? Number(pvNroMatch[1]) : 1;
    const nroComprobante = pvNroMatch ? Number(pvNroMatch[2]) : Number(onlyDigits(fdocNumber).slice(-8) || 0);

    return {
        tipoComprobante,
        puntoVenta,
        nroComprobante,
    };
};

const toFixedLength = (value: string, length: number) => {
    if (value.length === length) return value;
    if (value.length > length) return value.slice(0, length);
    return value.padEnd(length, ' ');
};

const sanitizeTxtField = (value?: string) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\r\n]+/g, ' ')
        .replace(/;/g, ' ')
        .replace(/[^\x20-\x7E]/g, ' ')
        .trim();

const toUnsignedScaled = (value: number, scale: number, length: number) => {
    const scaled = Math.round(Math.abs(Number(value || 0)) * scale);
    return String(scaled).padStart(length, '0').slice(-length);
};

const toAmountField = (value: number) => toUnsignedScaled(value, 100, 15);

const toExchangeRateField = (value: number) => toUnsignedScaled(value, 1_000_000, 10);

const toDateField = (value?: string) => toYmd(value) || '00000000';

async function getReportDocuments(filters?: FiscalDocumentReportFilters): Promise<FiscalDocumentReportRow[]> {
    let query = supabase
        .from('fiscal_documents')
        .select('id, fdoc_number, fdoc_date, total_amount, cae, cae_expiration_date, customer:customers(business_name,document_type,document_number), tax_details:fiscal_documents_detail(tax_percentage, base_amount, tax_amount, total_amount)')
        .order('fdoc_date', { ascending: true });

    if (filters?.customerId) {
        query = query.eq('customer_id', filters.customerId);
    }

    if (filters?.documentType === 'credit_note') {
        query = query.ilike('fdoc_number', '%NC%');
    } else if (filters?.documentType === 'invoice') {
        query = query.not('fdoc_number', 'ilike', '%NC%');
    }

    if (filters?.dateFrom) {
        const start = new Date(`${filters.dateFrom}T00:00:00`);
        query = query.gte('fdoc_date', start.toISOString());
    }

    if (filters?.dateTo) {
        const end = new Date(`${filters.dateTo}T00:00:00`);
        end.setDate(end.getDate() + 1);
        query = query.lt('fdoc_date', end.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []) as unknown as FiscalDocumentReportRow[];
}

export const fiscalDocumentService = {
    async getAll() {
        const { data, error } = await supabase
            .from('fiscal_documents')
            .select('*, customer:customers(business_name)')
            .order('fdoc_date', { ascending: false });

        if (error) throw error;
        return data as FiscalDocument[];
    },

    async getPaginated(
        page: number = 1,
        pageSize: number = 10,
        filters?: FiscalDocumentFilters
    ): Promise<PaginationResponse<FiscalDocument>> {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let countQuery = supabase
            .from('fiscal_documents')
            .select('*', { count: 'exact', head: true });

        let dataQuery = supabase
            .from('fiscal_documents')
            .select('*, customer:customers(business_name)');

        if (filters?.customerId) {
            countQuery = countQuery.eq('customer_id', filters.customerId);
            dataQuery = dataQuery.eq('customer_id', filters.customerId);
        }

        if (filters?.documentType === 'credit_note') {
            const creditPattern = 'fdoc_number.ilike.%NC%';
            countQuery = countQuery.or(creditPattern);
            dataQuery = dataQuery.or(creditPattern);
        } else if (filters?.documentType === 'invoice') {
            countQuery = countQuery.not('fdoc_number', 'ilike', '%NC%');
            dataQuery = dataQuery.not('fdoc_number', 'ilike', '%NC%');
        }

        if (filters?.puntoVenta != null) {
            countQuery = countQuery.eq('punto_de_venta', filters.puntoVenta);
            dataQuery = dataQuery.eq('punto_de_venta', filters.puntoVenta);
        }

        if (filters?.tipoComprobante != null) {
            countQuery = countQuery.eq('tipo_comprobante', filters.tipoComprobante);
            dataQuery = dataQuery.eq('tipo_comprobante', filters.tipoComprobante);
        }

        if (filters?.invoiceNumber) {
            const pattern = `%${filters.invoiceNumber}%`;
            countQuery = countQuery.ilike('fdoc_number', pattern);
            dataQuery = dataQuery.ilike('fdoc_number', pattern);
        }

        if (filters?.dateMode === 'exact' && filters.exactDate) {
            const exactStart = new Date(`${filters.exactDate}T00:00:00`);
            const exactEnd = new Date(`${filters.exactDate}T00:00:00`);
            exactEnd.setDate(exactEnd.getDate() + 1);

            countQuery = countQuery
                .gte('fdoc_date', exactStart.toISOString())
                .lt('fdoc_date', exactEnd.toISOString());

            dataQuery = dataQuery
                .gte('fdoc_date', exactStart.toISOString())
                .lt('fdoc_date', exactEnd.toISOString());
        }

        if (filters?.dateMode === 'range') {
            if (filters.dateFrom) {
                const rangeStart = new Date(`${filters.dateFrom}T00:00:00`);
                countQuery = countQuery.gte('fdoc_date', rangeStart.toISOString());
                dataQuery = dataQuery.gte('fdoc_date', rangeStart.toISOString());
            }

            if (filters.dateTo) {
                const rangeEnd = new Date(`${filters.dateTo}T00:00:00`);
                rangeEnd.setDate(rangeEnd.getDate() + 1);
                countQuery = countQuery.lt('fdoc_date', rangeEnd.toISOString());
                dataQuery = dataQuery.lt('fdoc_date', rangeEnd.toISOString());
            }
        }

        const { count } = await countQuery;

        const { data, error } = await dataQuery
            .order('fdoc_date', { ascending: false })
            .range(from, to);

        if (error) throw error;

        return {
            data: data as FiscalDocument[],
            total: count || 0,
            page,
            pageSize,   
            totalPages: Math.ceil((count || 0) / pageSize),
        };
    },

    async getById(id: string): Promise<FiscalDocumentDetail> {
        const { data, error } = await supabase
            .from('fiscal_documents')
            .select('*, customer:customers(*), order:orders(*, items:order_items(*, product:products(*))), tax_details:fiscal_documents_detail(*)')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as FiscalDocumentDetail;
    },

    async create(
        fiscalDocument: Partial<FiscalDocument>,
        options?: { taxDetails?: FiscalDocumentTaxDetailInput[] }
    ) {
        const { data, error } = await supabase
            .from('fiscal_documents')
            .upsert(fiscalDocument, { onConflict: 'fdoc_number,tenant_id' })
            .select()
            .single();

        if (error) throw error;

        const savedDocument = data as FiscalDocument;
        const computedTaxDetails = savedDocument.order_id
            ? await buildTaxDetailsFromOrder(savedDocument.order_id)
            : [];

        const taxDetails = computedTaxDetails.length > 0
            ? computedTaxDetails
            : (options?.taxDetails ?? []);

        await saveTaxDetails(savedDocument.id, taxDetails);

        return savedDocument;
    },

    async generateLibroIvaDigitalVentasCbteReport(filters?: FiscalDocumentReportFilters): Promise<string> {
        const documents = await getReportDocuments(filters);

        const lines = documents.map((doc) => {
            const { tipoComprobante, puntoVenta, nroComprobante } = parseVoucherData(doc.fdoc_number);
            const documentNumberDigits = onlyDigits(doc.customer?.document_number);
            const tipoDocCliente = Number(doc.customer?.document_type || (documentNumberDigits.length >= 11 ? 80 : 99));
            const nroDocCliente = documentNumberDigits || '0';
            const businessName = sanitizeTxtField(doc.customer?.business_name || 'CONSUMIDOR FINAL');
            const details = doc.tax_details || [];
            const alicuotasCount = new Set(
                details
                    .map((detail) => Number(detail.tax_percentage || 0))
                    .filter((value) => value > 0)
            ).size;

            const rawLine = [
                toDateField(doc.fdoc_date),
                String(tipoComprobante).padStart(3, '0'),
                String(puntoVenta).padStart(5, '0'),
                String(nroComprobante).padStart(20, '0'),
                String(nroComprobante).padStart(20, '0'),
                String(tipoDocCliente).padStart(2, '0'),
                onlyDigits(nroDocCliente).padStart(20, '0').slice(-20),
                toFixedLength(businessName, 30),
                toAmountField(Number(doc.total_amount || 0)),
                toAmountField(0),
                toAmountField(0),
                toAmountField(0),
                toAmountField(0),
                toAmountField(0),
                toAmountField(0),
                toAmountField(0),
                'PES',
                toExchangeRateField(1),
                String(Math.min(alicuotasCount, 9)),
                ' ',
                toAmountField(0),
                toDateField(doc.cae_expiration_date),
            ].join('');

            return toFixedLength(rawLine, 266);
        });

        return lines.join('\n');
    },

    async generateLibroIvaDigitalVentasAlicuotasReport(filters?: FiscalDocumentReportFilters): Promise<string> {
        const documents = await getReportDocuments(filters);

        const lines: string[] = [];

        for (const doc of documents) {
            const { tipoComprobante, puntoVenta, nroComprobante } = parseVoucherData(doc.fdoc_number);
            const details = doc.tax_details || [];
            for (const detail of details) {
                const percent = Number(detail.tax_percentage || 0);
                const alicuotaId = mapPercentToAlicuotaId(percent);

                lines.push([
                    tipoComprobante.toString().padStart(3, '0'),
                    String(puntoVenta).padStart(5, '0'),
                    String(nroComprobante).padStart(20, '0'),
                    toAmountField(Number(detail.base_amount || 0)),
                    alicuotaId.toString().padStart(4, '0'),
                    toAmountField(Number(detail.total_amount || 0)),
                ].join(';'));
            }
        }

        return lines.join('\n');
    }
};
