import React, { useEffect, useMemo, useState } from 'react';
import { FileText, FileDown, Printer } from 'lucide-react';
import { fiscalDocumentService, type FiscalDocumentDetail, type FiscalDocumentOrderItem, type FiscalDocumentFilters } from '../services/fiscalDocumentService';
import { exportToCSV, exportToPDF } from '../utils/exportUtils';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/shadcn-table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../components/ui/shadcn-pagination';
import { useServerPagination } from '../hooks/useServerPagination';
import LoadingPlaceholder from '../components/ui/LoadingPlaceholder';
import Layout from '../components/layout/Layout';
import FadeIn from '../components/ui/FadeIn';
import styles from './FiscalDocuments.module.css';
import clsx from 'clsx';
import { useToast } from '../context/ToastContext';
import { taxRateTypeService } from '../services/taxRateTypeService';
import { useTenant } from '../context/TenantContext';
import { tenantService } from '../services/tenantService';
import { customerService, type Customer } from '../services/customerService';
import { fiscalConditionService, type FiscalCondition } from '../services/fiscalConditionService';
import { TipoComprobante, TipoDocumento } from '../services/afip/constants';
import afipService from '../services/afipService';
import FiscalVoucherPreviewForm, { type VoucherPreviewFormData } from '../components/fiscal/FiscalVoucherPreviewForm';

interface CreditNotePreviewState extends VoucherPreviewFormData {
    ambiente: number;
    tipoConcepto: number;
    moneda: string;
    cotizacion: number;
    fechaComprobante: string;
}

const TIPO_COMPROBANTE_LABEL: Record<number, string> = {
    [TipoComprobante.FacturaA]: 'Factura A',
    [TipoComprobante.NotaDebitoA]: 'Nota Débito A',
    [TipoComprobante.NotaCreditoA]: 'Nota Crédito A',
    [TipoComprobante.FacturaB]: 'Factura B',
    [TipoComprobante.NotaDebitoB]: 'Nota Débito B',
    [TipoComprobante.NotaCreditoB]: 'Nota Crédito B',
    [TipoComprobante.FacturaC]: 'Factura C',
    [TipoComprobante.NotaDebitoC]: 'Nota Débito C',
    [TipoComprobante.NotaCreditoC]: 'Nota Crédito C',
    [TipoComprobante.FacturaE]: 'Factura E',
    [TipoComprobante.NotaDebitoE]: 'Nota Débito E',
    [TipoComprobante.NotaCreditoE]: 'Nota Crédito E',
};

const DOCUMENTO_OPTIONS = [
    { value: TipoDocumento.CUIT, label: 'CUIT' },
    { value: TipoDocumento.CUIL, label: 'CUIL' },
    { value: TipoDocumento.CDI, label: 'CDI' },
    { value: TipoDocumento.LE, label: 'LE' },
    { value: TipoDocumento.LC, label: 'LC' },
    { value: TipoDocumento.CI_Extranjera, label: 'CI Extranjera' },
    { value: TipoDocumento.EnTramite, label: 'En Tramite' },
    { value: TipoDocumento.Acta_Nacimiento, label: 'Acta Nacimiento' },
    { value: TipoDocumento.CI_Bs_As_RNP, label: 'CI Bs As RNP' },
    { value: TipoDocumento.DNI, label: 'DNI' },
    { value: TipoDocumento.Pasaporte, label: 'Pasaporte' },
    { value: TipoDocumento.CI_Policia_Federal, label: 'CI Policia Federal' },
    { value: TipoDocumento.SinIdentificar_Exterior, label: 'Sin Identificar Exterior' },
];

const FiscalDocuments: React.FC = () => {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailDestination, setEmailDestination] = useState('');
    const [selectedDocumentDetail, setSelectedDocumentDetail] = useState<FiscalDocumentDetail | null>(null);
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [taxRateTypePercentById, setTaxRateTypePercentById] = useState<Map<number, number>>(new Map());
    const [printingDocumentId, setPrintingDocumentId] = useState<string | null>(null);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [dateMode, setDateMode] = useState<'exact' | 'range'>('exact');
    const [exactDate, setExactDate] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [customerFilter, setCustomerFilter] = useState('');
    const [puntoVentaFilter, setPuntoVentaFilter] = useState('');
    const [tipoComprobanteFilter, setTipoComprobanteFilter] = useState('');
    const [invoiceNumberFilter, setInvoiceNumberFilter] = useState('');
    const [exportingCbte, setExportingCbte] = useState(false);
    const [fiscalConditions, setFiscalConditions] = useState<FiscalCondition[]>([]);
    const [isCreditNotePreviewOpen, setIsCreditNotePreviewOpen] = useState(false);
    const [isPreparingCreditNote, setIsPreparingCreditNote] = useState(false);
    const [isGeneratingCreditNote, setIsGeneratingCreditNote] = useState(false);
    const [creditNotePreview, setCreditNotePreview] = useState<CreditNotePreviewState | null>(null);
    const { showToast } = useToast();
    const { currentTenant } = useTenant();

    const activeFilters = useMemo<FiscalDocumentFilters>(() => ({
        dateMode,
        exactDate: dateMode === 'exact' ? exactDate : undefined,
        dateFrom: dateMode === 'range' ? dateFrom : undefined,
        dateTo: dateMode === 'range' ? dateTo : undefined,
        customerId: customerFilter || undefined,
        puntoVenta: puntoVentaFilter ? Number(puntoVentaFilter) : undefined,
        tipoComprobante: tipoComprobanteFilter ? Number(tipoComprobanteFilter) : undefined,
        invoiceNumber: invoiceNumberFilter || undefined,
    }), [dateMode, exactDate, dateFrom, dateTo, customerFilter, puntoVentaFilter, tipoComprobanteFilter, invoiceNumberFilter]);

    const {
        data: fiscal_documents,
        loading,
        currentPage,
        totalPages,
        goToPage,
        nextPage,
        previousPage,
        hasNextPage,
        hasPreviousPage,
    } = useServerPagination({
        fetchFunction: (page, pageSize) => fiscalDocumentService.getPaginated(page, pageSize, activeFilters),
        pageSize: 20,
        dependencies: [dateMode, exactDate, dateFrom, dateTo, customerFilter, puntoVentaFilter, tipoComprobanteFilter, invoiceNumberFilter],
    });

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const parsePercentFromNombre = (nombre: unknown) => {
            const match = String(nombre ?? '').match(/(\d+(?:\.\d+)?)/);
            return match ? Number(match[1]) : 0;
        };

        const loadTaxRateTypes = async () => {
            try {
                const taxRateTypes = await taxRateTypeService.getAll();
                const percentById = new Map<number, number>();
                for (const item of taxRateTypes) {
                    percentById.set(item.id, parsePercentFromNombre(item.nombre));
                }
                setTaxRateTypePercentById(percentById);
            } catch (error) {
                console.error('Error loading tax rate types:', error);
                setTaxRateTypePercentById(new Map());
            }
        };

        loadTaxRateTypes();
    }, []);

    useEffect(() => {
        const loadCustomers = async () => {
            try {
                const items = await customerService.getAll();
                setCustomers(items);
            } catch (error) {
                console.error('Error loading customers for filters:', error);
                setCustomers([]);
            }
        };

        loadCustomers();
    }, []);

    useEffect(() => {
        const loadFiscalConditions = async () => {
            try {
                const items = await fiscalConditionService.getAll();
                setFiscalConditions(items);
            } catch (error) {
                console.error('Error loading fiscal conditions:', error);
                setFiscalConditions([]);
            }
        };

        loadFiscalConditions();
    }, []);

    const clearFilters = () => {
        setDateMode('exact');
        setExactDate('');
        setDateFrom('');
        setDateTo('');
        setCustomerFilter('');
        setPuntoVentaFilter('');
        setTipoComprobanteFilter('');
        setInvoiceNumberFilter('');
    };

    const formatDate = (value?: string) => {
        if (!value) return 'N/A';
        return new Date(value).toLocaleDateString();
    };

    const formatTime = (value?: string) => {
        if (!value) return 'N/A';
        return new Date(value).toLocaleTimeString();
    };

    const formatCurrency = (value?: number) => `$${Number(value ?? 0).toFixed(2)}`;

    const parseLong = (val: unknown) => {
        if (!val) return 0;
        const str = String(val).replace(/[^0-9]/g, '');
        return str ? Number(str) : 0;
    };

    const getConsumerFieldValue = (value?: string, isAnonymous: boolean = false) => {
        if (isAnonymous) return 'N/A';
        if (!value || String(value).trim().length === 0) return 'N/A';
        return value;
    };

    const handleOpenDetailModal = async (documentId: string) => {
        setIsDetailModalOpen(true);
        setIsDetailLoading(true);
        setSelectedDocumentDetail(null);

        try {
            const detail = await fiscalDocumentService.getById(documentId);
            setSelectedDocumentDetail(detail);
        } catch (error) {
            console.error('Error loading fiscal document detail:', error);
            showToast('No se pudo cargar el detalle del comprobante', 'error');
            setIsDetailModalOpen(false);
        } finally {
            setIsDetailLoading(false);
        }
    };

    const handleCloseDetailModal = () => {
        setIsDetailModalOpen(false);
        setIsCreditNotePreviewOpen(false);
        setIsEmailModalOpen(false);
        setEmailDestination('');
        setCreditNotePreview(null);
        setIsPreparingCreditNote(false);
        setIsGeneratingCreditNote(false);
        setSelectedDocumentDetail(null);
        setIsDetailLoading(false);
    };

    const handleCreateCreditNote = async () => {
        if (!selectedDocumentDetail) return;

        try {
            if (!currentTenant?.settings) {
                showToast('Error: No se encontraron configuraciones del tenant', 'error');
                return;
            }

            setIsPreparingCreditNote(true);

            const settings = currentTenant.settings;
            const tipoFacturaOriginal = tipoComprobante ?? TipoComprobante.FacturaC;
            const tipoComprobanteNota = tipoFacturaOriginal === TipoComprobante.FacturaA
                ? TipoComprobante.NotaCreditoA
                : tipoFacturaOriginal === TipoComprobante.FacturaB
                    ? TipoComprobante.NotaCreditoB
                    : tipoFacturaOriginal === TipoComprobante.FacturaE
                        ? TipoComprobante.NotaCreditoE
                        : TipoComprobante.NotaCreditoC;

            const rawCustomerDoc = String(selectedDocumentDetail.customer?.document_number || '').replace(/\D/g, '');
            const customerDocType = Number(selectedDocumentDetail.customer?.document_type || TipoDocumento.SinIdentificar_Exterior);

            const ivaById = new Map<number, { baseImponible: number; importe: number }>();
            for (const detail of selectedDocumentDetail.tax_details || []) {
                const id = Number(detail.tax_rate_type_id ?? 0);
                const base = Number(detail.base_amount ?? 0);
                const imp = Number(detail.tax_amount ?? 0);
                if (!id || imp <= 0) continue;

                const bucket = ivaById.get(id) ?? { baseImponible: 0, importe: 0 };
                bucket.baseImponible += base;
                bucket.importe += imp;
                ivaById.set(id, bucket);
            }

            const ivaList = Array.from(ivaById.entries()).map(([id, item]) => ({
                id,
                baseImponible: Number(item.baseImponible.toFixed(2)),
                importe: Number(item.importe.toFixed(2)),
            }));

            const totalAmount = Math.abs(Number(selectedDocumentDetail.total_amount ?? 0));
            const netAmount = Number(productTotals.net.toFixed(2));
            const ivaAmount = Number((totalAmount - netAmount).toFixed(2));

            setCreditNotePreview({
                emisorRazonSocial: String(settings.company_name || currentTenant.name || ''),
                emisorCuit: String(settings.company_cuit || ''),
                receptorRazonSocial: selectedDocumentDetail.customer?.business_name || 'Consumidor Final',
                receptorCondicionFiscalId: Number((selectedDocumentDetail.customer as Customer | undefined)?.condicion_fiscal_id || 0),
                receptorTipoDocumento: customerDocType,
                receptorNumeroDocumento: rawCustomerDoc,
                tipoComprobante: tipoComprobanteNota,
                puntoVenta: parseLong(settings.afip_punto_venta),
                importeTotal: totalAmount,
                importeNeto: netAmount,
                importeIVA: ivaAmount,
                importeTributo: Number((totalAmount - netAmount).toFixed(2)),
                ivaList,
                ambiente: settings.afip_environment === 'production' ? 1 : 2,
                tipoConcepto: 1,
                moneda: 'PES',
                cotizacion: 1,
                fechaComprobante: new Date().toISOString(),
            });

            setIsCreditNotePreviewOpen(true);
        } catch (error) {
            console.error('Error preparing credit note preview:', error);
            showToast('No se pudo preparar la previsualizacion de la nota de credito', 'error');
        } finally {
            setIsPreparingCreditNote(false);
        }
    };

    const handleConfirmCreateCreditNote = async () => {
        if (!selectedDocumentDetail || !creditNotePreview) return;

        try {
            setIsGeneratingCreditNote(true);

            const cuit = parseLong(creditNotePreview.emisorCuit);
            const puntoVenta = parseLong(creditNotePreview.puntoVenta);

            if (!cuit) {
                showToast('Error: CUIT del emisor invalido', 'error');
                return;
            }

            if (!puntoVenta) {
                showToast('Error: Punto de venta invalido', 'error');
                return;
            }

            const tipoFacturaOriginal = tipoComprobante ?? TipoComprobante.FacturaC;
            const comprobanteMatch = String(selectedDocumentDetail.fdoc_number ?? '').match(/(\d{4})-(\d{8})/);
            const puntoDeVentaOriginal = comprobanteMatch ? Number(comprobanteMatch[1]) : puntoVenta;
            const numeroFactura = comprobanteMatch ? Number(comprobanteMatch[2]) : 0;

            const receptorDocDigits = String(creditNotePreview.receptorNumeroDocumento || '').replace(/\D/g, '');
            const tipoDocCliente = Number(creditNotePreview.receptorTipoDocumento || TipoDocumento.SinIdentificar_Exterior);
            const dniCliente = Number(receptorDocDigits || 0);

            const isComprobanteConIvaDiscriminado =
                creditNotePreview.tipoComprobante === TipoComprobante.NotaCreditoA ||
                creditNotePreview.tipoComprobante === TipoComprobante.NotaCreditoB;

            const objNotaDeCredito = {
                ambiente: creditNotePreview.ambiente,
                cuit,
                puntoVenta,
                numeroComprobante: 0, // AFIP asigna el numero de comprobante
                tipoComprobante: creditNotePreview.tipoComprobante,
                tipoConcepto: creditNotePreview.tipoConcepto,
                tipoDocCliente,
                dniCliente,
                importeNeto: Number(creditNotePreview.importeNeto),
                importeTotal: Number(creditNotePreview.importeTotal),
                importeTributo: isComprobanteConIvaDiscriminado ? Number(creditNotePreview.importeTributo) : 0,
                importeIVA: isComprobanteConIvaDiscriminado ? Number(creditNotePreview.importeIVA) : 0,
                moneda: creditNotePreview.moneda,
                cotizacion: Number(creditNotePreview.cotizacion || 1),
                ivaList: isComprobanteConIvaDiscriminado ? creditNotePreview.ivaList : [],
                fechaComprobante: creditNotePreview.fechaComprobante,
                tipoFacturaOriginal,
                puntoDeVentaOriginal,
                numeroFactura,
                fechaFacturaOriginal: selectedDocumentDetail.fdoc_date,
            };

            const tiposTributo = await afipService.getTiposTributo(objNotaDeCredito.cuit, objNotaDeCredito.ambiente);
            if (!tiposTributo.length) {
                showToast('AFIP no devolvio tipos de tributo. Verifica la conexion con AFIP.', 'error');
                return;
            }

            const afipResult = await afipService.generateCreditNote(objNotaDeCredito);
            const afipResponse = afipResult.response;

            if (afipResponse.resultado !== 'A' || !afipResponse.cae) {
                const msg = afipResponse.observacion
                    ? `AFIP rechazo la nota de credito: ${afipResponse.observacion}`
                    : `AFIP rechazo la nota de credito (resultado: ${afipResponse.resultado})`;
                showToast(msg, 'error', 9000);
                return;
            }

            const nowIso = creditNotePreview.fechaComprobante || new Date().toISOString();
            const suffix = Date.now().toString().slice(-6);
            const caeFchVto = afipResponse.caeFchVto;
            const caeExpDate = caeFchVto && caeFchVto.length === 8
                ? `${caeFchVto.slice(0, 4)}-${caeFchVto.slice(4, 6)}-${caeFchVto.slice(6, 8)}T00:00:00Z`
                : undefined;
            const fdocNumber = afipResponse.comprobanteDescripcion || `${selectedDocumentDetail.fdoc_number}-NC-${suffix}`;

            await fiscalDocumentService.create({
                customer_id: selectedDocumentDetail.customer_id,
                order_id: selectedDocumentDetail.order_id,
                total_amount: -Math.abs(Number(creditNotePreview.importeTotal ?? selectedDocumentDetail.total_amount ?? 0)),
                fdoc_number: fdocNumber,
                fdoc_date: nowIso,
                due_date: nowIso,
                status: 'Aprobada',
                cae: afipResponse.cae,
                cae_expiration_date: caeExpDate,
                punto_de_venta: creditNotePreview.puntoVenta,
                tipo_comprobante: creditNotePreview.tipoComprobante,
                numero_comprobante: afipResponse.comprobanteNro,
            });

            setIsCreditNotePreviewOpen(false);
            setCreditNotePreview(null);
            showToast('Nota de credito generada exitosamente', 'success');
            handleCloseDetailModal();
            goToPage(currentPage);
        } catch (error) {
            console.error('Error creating credit note:', error);
            showToast('No se pudo generar la nota de credito', 'error');
        } finally {
            setIsGeneratingCreditNote(false);
        }
    };

    const handleOpenShareByEmailModal = () => {
        if (!selectedDocumentDetail) return;

        const initialEmail = selectedDocumentDetail.customer?.email ?? '';
        setEmailDestination(initialEmail);
        setIsEmailModalOpen(true);
    };

    const handleCloseEmailModal = () => {
        setIsEmailModalOpen(false);
    };

    const handleShareByEmail = () => {
        if (!selectedDocumentDetail) return;

        const email = emailDestination.trim();

        if (!email) {
            showToast('Ingresá un email de destino', 'error');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showToast('Ingresá un email válido', 'error');
            return;
        }

        const subject = encodeURIComponent(`Comprobante ${selectedDocumentDetail.fdoc_number}`);
        const body = encodeURIComponent(
            `Adjunto comprobante ${selectedDocumentDetail.fdoc_number}\n` +
            `Fecha: ${formatDate(selectedDocumentDetail.fdoc_date)} ${formatTime(selectedDocumentDetail.fdoc_date)}\n` +
            `Total: ${formatCurrency(selectedDocumentDetail.total_amount)}\n` +
            `CAE: ${selectedDocumentDetail.cae || 'N/A'}`
        );

        window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
        setIsEmailModalOpen(false);
    };

    const getPrintItemsFromDetail = (detail: FiscalDocumentDetail) => {
        if (detail.tax_details && detail.tax_details.length > 0) {
            return detail.tax_details.map((item) => {
                const quantity = Number(item.quantity ?? 0);
                const unitPrice = quantity > 0
                    ? Number(item.line_total ?? item.total_amount ?? 0) / quantity
                    : Number(item.unit_price ?? 0);

                return {
                    name: item.product_name || 'Producto',
                    quantity,
                    price: unitPrice,
                };
            });
        }

        return (detail.order?.items || []).map((item) => ({
            name: item.product?.name || 'Producto',
            quantity: Number(item.quantity ?? 0),
            price: Number(item.unit_price ?? item.product?.sale_price ?? 0),
        }));
    };

    const handlePrintInvoice = async (invoiceId: string, detailFromModal?: FiscalDocumentDetail) => {
        setPrintingDocumentId(invoiceId);
        try {
            showToast('Preparando impresión...', 'info');

            const detail = detailFromModal ?? await fiscalDocumentService.getById(invoiceId);
            const printItems = getPrintItemsFromDetail(detail);
            if (printItems.length === 0) {
                showToast('El comprobante no tiene productos para imprimir', 'error');
                return;
            }

            const endpoint = 'http://localhost:3001/imprimirFactura';

            const tenantForPrint = currentTenant ?? await tenantService.getUserPrimaryTenant();
            const companyName = tenantForPrint?.settings?.company_name || tenantForPrint?.name || 'Mi Empresa';

            const printPayload = {
                nombreEmpresa: companyName,
                fecha: detail.fdoc_date || new Date().toISOString(),
                numeroComprobante: detail.fdoc_number,
                tipoComprobante: 'FACTURA',
                items: printItems,
                total: Number(detail.total_amount ?? 0),
                pieDePagina: 'Gracias por su compra',
                CAE: detail.cae || '',
                fechaVtoCAE: detail.cae_expiration_date || '',
            };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(printPayload),
            });

            if (!response.ok) {
                throw new Error(`Error de impresión (${response.status})`);
            }

            showToast('Comprobante enviado a la impresora', 'success');
        } catch (error) {
            console.error('Error printing invoice:', error);
            showToast('Error al imprimir la factura', 'error');
        } finally {
            setPrintingDocumentId(null);
        }
    };

    const orderItems = useMemo<FiscalDocumentOrderItem[]>(() => {
        return selectedDocumentDetail?.order?.items || [];
    }, [selectedDocumentDetail]);

    const productRows = useMemo(() => {
        const persistedTaxDetails = selectedDocumentDetail?.tax_details || [];

        if (persistedTaxDetails.length > 0) {
            return persistedTaxDetails.map((detail) => {
                const quantity = Number(detail.quantity ?? 0);
                const lineSubtotal = Number(detail.line_subtotal ?? detail.base_amount ?? 0);
                const lineTotal = Number(detail.line_total ?? detail.total_amount ?? 0);
                const unitWithoutTax = quantity > 0 ? lineSubtotal / quantity : 0;
                const unitWithTax = quantity > 0 ? lineTotal / quantity : 0;

                return {
                    quantity,
                    productName: detail.product_name || 'Producto sin nombre',
                    ivaPercent: Number(detail.tax_percentage ?? 0),
                    unitWithoutTax,
                    unitWithTax,
                    lineWithTax: lineTotal,
                };
            });
        }

        return orderItems.map((item) => {
            const quantity = Number(item?.quantity ?? 0);
            const unitWithTax = Number(item?.unit_price ?? item?.product?.sale_price ?? 0);
            const taxRateTypeId = Number(item?.product?.tax_rate ?? item?.tax_rate ?? 0);
            const ivaPercent = taxRateTypePercentById.get(taxRateTypeId) ?? 0;
            const unitWithoutTax = ivaPercent > 0
                ? unitWithTax / (1 + ivaPercent / 100)
                : unitWithTax;
            const lineWithTax = quantity * unitWithTax;

            return {
                quantity,
                productName: item?.product?.name || 'Producto sin nombre',
                ivaPercent,
                unitWithoutTax,
                unitWithTax,
                lineWithTax,
            };
        });
    }, [orderItems, taxRateTypePercentById, selectedDocumentDetail?.tax_details]);

    const productTotals = useMemo(() => {
        const net = productRows.reduce((acc, row) => acc + (row.quantity * row.unitWithoutTax), 0);
        const total = productRows.reduce((acc, row) => acc + row.lineWithTax, 0);
        const iva = total - net;

        return {
            net,
            iva,
            total,
        };
    }, [productRows]);

    const consumerName = selectedDocumentDetail?.customer?.business_name ?? '';
    const isAnonymousConsumer = /consumidor final|anonim/i.test(consumerName) || !consumerName;

    const tipoComprobanteValues = Object.values(TipoComprobante) as number[];
    const creditNoteTypes: number[] = [
        TipoComprobante.NotaCreditoA,
        TipoComprobante.NotaCreditoB,
        TipoComprobante.NotaCreditoC,
        TipoComprobante.NotaCreditoE,
    ];

    const tipoComprobante = useMemo(() => {
        if (!selectedDocumentDetail) return null;

        const detailWithTipo = selectedDocumentDetail as FiscalDocumentDetail & {
            tipoComprobante?: number;
            tipo_comprobante?: number;
        };

        const fromField = Number(detailWithTipo.tipoComprobante ?? detailWithTipo.tipo_comprobante);
        if (Number.isFinite(fromField) && tipoComprobanteValues.includes(fromField)) {
            return fromField;
        }

        const fdocNumber = selectedDocumentDetail.fdoc_number ?? '';
        return /\bNC\b|nota\s*de\s*cr[eé]dito/i.test(fdocNumber)
            ? TipoComprobante.NotaCreditoC
            : TipoComprobante.FacturaC;
    }, [selectedDocumentDetail, tipoComprobanteValues]);

    const isTipoCNoIvaDiscriminado = tipoComprobante === TipoComprobante.FacturaC || tipoComprobante === TipoComprobante.NotaCreditoC;

    const isCreditNoteDocument = tipoComprobante !== null && creditNoteTypes.includes(tipoComprobante);

    const creditNoteComprobanteOptions = useMemo(() => {
        if (!creditNotePreview) return [];

        const labelByType: Record<number, string> = {
            [TipoComprobante.NotaCreditoA]: 'Nota de Credito A',
            [TipoComprobante.NotaCreditoB]: 'Nota de Credito B',
            [TipoComprobante.NotaCreditoC]: 'Nota de Credito C',
            [TipoComprobante.NotaCreditoE]: 'Nota de Credito E',
        };

        return [{
            value: creditNotePreview.tipoComprobante,
            label: labelByType[creditNotePreview.tipoComprobante] || 'Nota de Credito',
        }];
    }, [creditNotePreview]);

    const shouldShowCreditNoteIvaFields = creditNotePreview
        ? creditNotePreview.tipoComprobante === TipoComprobante.NotaCreditoA || creditNotePreview.tipoComprobante === TipoComprobante.NotaCreditoB
        : false;

    const handleExportAll = async () => {
        const allInvoices = await fiscalDocumentService.getAll();
        return allInvoices;
    };

    const downloadTxt = (content: string, fileNamePrefix: string) => {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileNamePrefix}_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const getLibroIvaFilters = () => {
        const dateFilters = dateMode === 'exact' && exactDate
            ? { dateFrom: exactDate, dateTo: exactDate }
            : { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined };

        return {
            ...dateFilters,
            customerId: customerFilter || undefined,
        };
    };

    const handleExportLibroIvaCbte = async () => {
        setExportingCbte(true);
        try {
            const content = await fiscalDocumentService.generateLibroIvaDigitalVentasCbteReport(getLibroIvaFilters());
            downloadTxt(content, 'LIBRO_IVA_DIGITAL_VENTAS_CBTE');
            showToast('Reporte CBTE generado', 'success');
        } catch (error) {
            console.error('Error exporting CBTE report:', error);
            showToast('Error al generar LIBRO_IVA_DIGITAL_VENTAS_CBTE', 'error');
        } finally {
            setExportingCbte(false);
        }
        setExportingCbte(true);
        try {
            const content = await fiscalDocumentService.generateLibroIvaDigitalVentasAlicuotasReport(getLibroIvaFilters());
            downloadTxt(content, 'LIBRO_IVA_DIGITAL_VENTAS_ALICUOTAS');
            showToast('Reporte ALICUOTAS generado', 'success');
        } catch (error) {
            console.error('Error exporting ALICUOTAS report:', error);
            showToast('Error al generar LIBRO_IVA_DIGITAL_VENTAS_ALICUOTAS', 'error');
        } finally {
            setExportingCbte(false);
        }
    };

    return (
        <Layout title="Comprobantes">
            <FadeIn>
                <div className={styles.container}>
                    <div className={styles.filtersPanel} style={{ marginBottom: 'var(--spacing-xs)' }}>
                    <div className={styles.filtersGrid}>
                        <div className={styles.filterGroup}>
                            <label className={styles.filterLabel}>Modo de fecha</label>
                            <select
                                className={styles.filterInput}
                                value={dateMode}
                                onChange={(e) => setDateMode(e.target.value as 'exact' | 'range')}
                            >
                                <option value="exact">Fecha exacta</option>
                                <option value="range">Rango de fechas</option>
                            </select>
                        </div>

                        {dateMode === 'exact' ? (
                            <div className={styles.filterGroup}>
                                <label className={styles.filterLabel}>Fecha</label>
                                <input
                                    className={styles.filterInput}
                                    type="date"
                                    value={exactDate}
                                    onChange={(e) => setExactDate(e.target.value)}
                                />
                            </div>
                        ) : (
                            <>
                                <div className={styles.filterGroup}>
                                    <label className={styles.filterLabel}>Desde</label>
                                    <input
                                        className={styles.filterInput}
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                    />
                                </div>
                                <div className={styles.filterGroup}>
                                    <label className={styles.filterLabel}>Hasta</label>
                                    <input
                                        className={styles.filterInput}
                                        type="date"
                                        value={dateTo}
                                        onChange={(e) => setDateTo(e.target.value)}
                                    />
                                </div>
                            </>
                        )}

                        <div className={styles.filterGroup}>
                            <label className={styles.filterLabel}>Cliente</label>
                            <select
                                className={styles.filterInput}
                                value={customerFilter}
                                onChange={(e) => setCustomerFilter(e.target.value)}
                            >
                                <option value="">Todos los clientes</option>
                                {customers.map((customer) => (
                                    <option key={customer.id} value={customer.id}>
                                        {customer.business_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.filterGroup}>
                            <label className={styles.filterLabel}>Comprobante AFIP</label>
                            <select
                                className={styles.filterInput}
                                value={tipoComprobanteFilter}
                                onChange={(e) => setTipoComprobanteFilter(e.target.value)}
                            >
                                <option value="">Todos</option>
                                <option value="1">Factura A</option>
                                <option value="3">Nota de Crédito A</option>
                                <option value="6">Factura B</option>
                                <option value="8">Nota de Crédito B</option>
                                <option value="11">Factura C</option>
                                <option value="13">Nota de Crédito C</option>
                                <option value="19">Factura E</option>
                                <option value="21">Nota de Crédito E</option>
                            </select>
                        </div>

                        <div className={styles.filterGroup}>
                            <label className={styles.filterLabel}>Punto de venta</label>
                            <input
                                className={styles.filterInput}
                                type="number"
                                min="1"
                                placeholder="Ej: 1"
                                value={puntoVentaFilter}
                                onChange={(e) => setPuntoVentaFilter(e.target.value)}
                            />
                        </div>

                        <div className={styles.filterGroup}>
                            <label className={styles.filterLabel}>Nro. de factura</label>
                            <input
                                className={styles.filterInput}
                                type="text"
                                placeholder="Buscar número..."
                                value={invoiceNumberFilter}
                                onChange={(e) => setInvoiceNumberFilter(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className={styles.filtersActions}>
                        <Button variant="secondary" size="sm" onClick={clearFilters}>
                            Limpiar filtros
                        </Button>
                        <div className={styles.filtersExportActions}>
                            <Button
                                variant="ghost"
                                onClick={handleExportLibroIvaCbte}
                                title="Exportar LIBRO_IVA_DIGITAL_VENTAS_CBTE"
                                isLoading={exportingCbte}
                            >
                                Generar libro de iva ventas
                            </Button>
                            <Button 
                                variant="ghost" 
                                onClick={async () => {
                                    const allInvoices = await handleExportAll();
                                    exportToCSV(
                                        allInvoices.map(i => ({
                                            factura: i.fdoc_number,
                                            cliente: i.customer?.business_name || 'Desconocido',
                                            fecha: new Date(i.fdoc_date).toLocaleDateString(),
                                            monto: `$${i.total_amount.toFixed(2)}`,
                                            estado: i.status
                                        })),
                                        'facturas',
                                        [
                                            { header: 'Factura', key: 'factura' },
                                            { header: 'Cliente', key: 'cliente' },
                                            { header: 'Fecha', key: 'fecha' },
                                            { header: 'Monto', key: 'monto' },
                                            { header: 'Estado', key: 'estado' }
                                        ]
                                    );
                                }}
                                title="Exportar a CSV"
                            >
                                <FileText size={20} />
                            </Button>
                            <Button 
                                variant="ghost" 
                                onClick={async () => {
                                    const allInvoices = await handleExportAll();
                                    exportToPDF(
                                        allInvoices.map(i => ({
                                            factura: i.fdoc_number,
                                            cliente: i.customer?.business_name || 'Desconocido',
                                            fecha: new Date(i.fdoc_date).toLocaleDateString(),
                                            monto: `$${i.total_amount.toFixed(2)}`,
                                            estado: i.status
                                        })),
                                        'facturas',
                                        [
                                            { header: 'Factura', key: 'factura' },
                                            { header: 'Cliente', key: 'cliente' },
                                            { header: 'Fecha', key: 'fecha' },
                                            { header: 'Monto', key: 'monto' },
                                            { header: 'Estado', key: 'estado' }
                                        ],
                                        'Listado de Facturas'
                                    );
                                }}
                                title="Exportar a PDF"
                            >
                                <FileDown size={20} />
                            </Button>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <LoadingPlaceholder />
                ) : fiscal_documents.length > 0 ? (
                    <div>
                        {!isMobile && (
                            <div className="rounded-md overflow-hidden" style={{ 
                                border: '1px solid var(--color-border)'
                            }}>
                            <Table>
                                <TableHeader>
                                    <TableRow style={{ 
                                        backgroundColor: 'var(--table-header-bg)',
                                        color: 'var(--table-header-text)',
                                    }}>
                                        <TableHead>Comprobante</TableHead>
                                        <TableHead>Pto. Venta</TableHead>
                                        <TableHead>Nro. Cbte</TableHead>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Monto</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {fiscal_documents.map((invoice) => (
                                        <TableRow key={invoice.id}>
                                            <TableCell>{TIPO_COMPROBANTE_LABEL[invoice.tipo_comprobante ?? 0] ?? invoice.tipo_comprobante ?? '—'}</TableCell>
                                            <TableCell>{invoice.punto_de_venta != null ? invoice.punto_de_venta : '—'}</TableCell>
                                            <TableCell>{invoice.numero_comprobante != null ? invoice.numero_comprobante : '—'}</TableCell>
                                            <TableCell>{invoice.customer?.business_name || 'Desconocido'}</TableCell>
                                            <TableCell>{new Date(invoice.fdoc_date).toLocaleDateString()} {new Date(invoice.fdoc_date).toLocaleTimeString()}</TableCell>
                                            <TableCell>${invoice.total_amount.toFixed(2)}</TableCell>
                                            <TableCell>
                                                <span className={clsx(styles.status, styles[invoice.status])}>
                                                    {invoice.status}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handlePrintInvoice(invoice.id)}
                                                        title="Imprimir factura"
                                                        disabled={printingDocumentId === invoice.id}
                                                    >
                                                        <Printer size={16} />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleOpenDetailModal(invoice.id)}
                                                    >
                                                        Ver detalle
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        )}

                        {isMobile && (
                            <div className={styles.mobileCardList}>
                                {fiscal_documents.map((invoice) => (
                                    <div key={invoice.id} className={styles.mobileCard}>
                                        <div className={styles.mobileCardHeader}>
                                            <div className={styles.mobileCardInfo}>
                                                <h3 className={styles.mobileCardTitle}>{invoice.fdoc_number}</h3>
                                                <p className={styles.mobileCardSubtitle}>{invoice.customer?.business_name || 'Desconocido'}</p>
                                            </div>
                                        </div>
                                        <div className={styles.mobileCardDetails}>
                                            <div className={styles.mobileCardRow}>
                                                <span className={styles.mobileCardLabel}>Fecha:</span>
                                                <span className={styles.mobileCardValue}>{new Date(invoice.fdoc_date).toLocaleDateString()}</span>
                                            </div>
                                            <div className={styles.mobileCardRow}>
                                                <span className={styles.mobileCardLabel}>Monto:</span>
                                                <span className={styles.mobileCardPrice}>${invoice.total_amount.toFixed(2)}</span>
                                            </div>
                                            <div className={styles.mobileCardRow}>
                                                <span className={styles.mobileCardLabel}>Estado:</span>
                                                <span className={clsx(styles.status, styles[invoice.status])}>
                                                    {invoice.status}
                                                </span>
                                            </div>
                                        </div>
                                        <div className={styles.mobileCardActions}>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handlePrintInvoice(invoice.id)}
                                                title="Imprimir factura"
                                                disabled={printingDocumentId === invoice.id}
                                            >
                                                <Printer size={16} />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleOpenDetailModal(invoice.id)}
                                            >
                                                Ver detalle
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                    {totalPages > 1 && (
                        <div className="flex justify-center mt-4">
                            <Pagination>
                                <PaginationContent>
                                    <PaginationItem>
                                        <PaginationPrevious 
                                            onClick={previousPage}
                                            className={!hasPreviousPage ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                                        />
                                    </PaginationItem>

                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                        <PaginationItem key={page}>
                                            <PaginationLink
                                                onClick={() => goToPage(page)}
                                                isActive={currentPage === page}
                                                className="cursor-pointer"
                                            >
                                                {page}
                                            </PaginationLink>
                                        </PaginationItem>
                                    ))}

                                    <PaginationItem>
                                        <PaginationNext 
                                            onClick={nextPage}
                                            className={!hasNextPage ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                                        />
                                    </PaginationItem>
                                </PaginationContent>
                            </Pagination>
                        </div>
                    )}
                    </div>
                ) : (
                    <div
                        style={{
                            padding: 'var(--spacing-xl)',
                            textAlign: 'center',
                            color: 'var(--color-text-muted)',
                        }}
                    >
                        No se encontraron facturas.
                    </div>
                )}
                </div>

                <Modal
                    isOpen={isDetailModalOpen}
                    onClose={handleCloseDetailModal}
                    title={selectedDocumentDetail
                        ? `Comprobante ${TIPO_COMPROBANTE_LABEL[selectedDocumentDetail.tipo_comprobante ?? 0] ?? ''} ${String(selectedDocumentDetail.punto_de_venta ?? '').padStart(4, '0')}-${String(selectedDocumentDetail.numero_comprobante ?? '').padStart(8, '0')}`.trim()
                        : 'Comprobante'
                    }
                >
                    {isDetailLoading ? (
                        <LoadingPlaceholder />
                    ) : selectedDocumentDetail ? (
                        <div className={styles.detailWrapper}>
                            <div className={styles.detailSection}>
                                <h3 className={styles.detailSectionTitle}>Comprobante</h3>
                                <div className={styles.detailGrid}>
                                    <div><strong>Número:</strong> {selectedDocumentDetail.fdoc_number || 'N/A'}</div>
                                    <div><strong>Fecha:</strong> {formatDate(selectedDocumentDetail.fdoc_date)}</div>
                                    <div><strong>Hora:</strong> {formatTime(selectedDocumentDetail.fdoc_date)}</div>
                                    <div><strong>Total:</strong> {formatCurrency(selectedDocumentDetail.total_amount)}</div>
                                    <div><strong>CAE:</strong> {selectedDocumentDetail.cae || 'N/A'}</div>
                                    <div><strong>Vto. CAE:</strong> {formatDate(selectedDocumentDetail.cae_expiration_date)}</div>
                                </div>
                            </div>

                            <div className={styles.detailSection}>
                                <h3 className={styles.detailSectionTitle}>Datos del consumidor</h3>
                                <div className={styles.detailGrid}>
                                    <div><strong>Razón social:</strong> {getConsumerFieldValue(selectedDocumentDetail.customer?.business_name, isAnonymousConsumer)}</div>
                                    <div><strong>Contacto:</strong> {getConsumerFieldValue(selectedDocumentDetail.customer?.contact_name, isAnonymousConsumer)}</div>
                                    <div><strong>Email:</strong> {getConsumerFieldValue(selectedDocumentDetail.customer?.email, isAnonymousConsumer)}</div>
                                    <div><strong>Teléfono:</strong> {getConsumerFieldValue(selectedDocumentDetail.customer?.phone, isAnonymousConsumer)}</div>
                                    <div><strong>Documento:</strong> {getConsumerFieldValue(selectedDocumentDetail.customer?.document_number, isAnonymousConsumer)}</div>
                                    <div><strong>Dirección:</strong> {getConsumerFieldValue(selectedDocumentDetail.customer?.address, isAnonymousConsumer)}</div>
                                </div>
                            </div>

                            <div className={styles.detailSection}>
                                <h3 className={styles.detailSectionTitle}>Productos</h3>
                                {productRows.length > 0 ? (
                                    <div>
                                        <div className={styles.productsTableWrapper}>
                                            <table className={styles.productsTable}>
                                                <thead>
                                                    <tr>
                                                        <th>Cant.</th>
                                                        <th>Producto</th>
                                                        <th>Importe</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {productRows.map((row, index) => (
                                                        <tr key={`${row.productName}-${index}`}>
                                                            <td>{row.quantity}</td>
                                                            <td>{row.productName}</td>
                                                            <td>{formatCurrency(row.unitWithTax)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className={styles.productsTotals}>
                                            <div>
                                                <strong>{isTipoCNoIvaDiscriminado ? 'Subtotal:' : 'Subtotal neto:'}</strong>{' '}
                                                {formatCurrency(isTipoCNoIvaDiscriminado ? productTotals.total : productTotals.net)}
                                            </div>
                                            {!isTipoCNoIvaDiscriminado && (
                                                <div><strong>Total IVA:</strong> {formatCurrency(productTotals.iva)}</div>
                                            )}
                                            <div><strong>Total final:</strong> {formatCurrency(productTotals.total)}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <p className={styles.emptyDetailText}>No hay productos asociados a este comprobante.</p>
                                )}
                            </div>

                            <div className={styles.detailActions}>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    className={styles.detailActionButton}
                                    onClick={() => selectedDocumentDetail && handlePrintInvoice(selectedDocumentDetail.id, selectedDocumentDetail)}
                                    disabled={printingDocumentId === selectedDocumentDetail.id}
                                >
                                    Imprimir factura
                                </Button>
                                {!isCreditNoteDocument && (
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        className={styles.detailActionButton}
                                        onClick={handleCreateCreditNote}
                                        isLoading={isPreparingCreditNote}
                                        disabled={isGeneratingCreditNote}
                                    >
                                        Hacer nota de crédito
                                    </Button>
                                )}
                                <Button variant="primary" size="sm" className={styles.detailActionButton} onClick={handleOpenShareByEmailModal}>
                                    Compartir por email
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <p className={styles.emptyDetailText}>No se encontró información del comprobante.</p>
                    )}
                </Modal>

                <Modal
                    isOpen={isEmailModalOpen}
                    onClose={handleCloseEmailModal}
                    title="Enviar comprobante por email"
                >
                    <div className={styles.emailModalContent}>
                        <label className={styles.emailLabel}>Email destino</label>
                        <input
                            type="email"
                            value={emailDestination}
                            onChange={(e) => setEmailDestination(e.target.value)}
                            className={styles.emailInput}
                            placeholder="cliente@email.com"
                        />
                        <div className={styles.emailModalActions}>
                            <Button variant="secondary" size="sm" onClick={handleCloseEmailModal}>
                                Cancelar
                            </Button>
                            <Button variant="primary" size="sm" onClick={handleShareByEmail}>
                                Enviar
                            </Button>
                        </div>
                    </div>
                </Modal>

                <Modal
                    isOpen={isCreditNotePreviewOpen}
                    onClose={() => {
                        if (!isGeneratingCreditNote) {
                            setIsCreditNotePreviewOpen(false);
                            setCreditNotePreview(null);
                        }
                    }}
                    title="Previsualizacion de Nota de Credito"
                >
                    {isPreparingCreditNote || !creditNotePreview ? (
                        <LoadingPlaceholder />
                    ) : (
                        <FiscalVoucherPreviewForm
                            data={creditNotePreview}
                            onChange={(updater) => setCreditNotePreview((prev) => (prev ? updater(prev) : prev))}
                            fiscalConditions={fiscalConditions}
                            documentOptions={DOCUMENTO_OPTIONS}
                            comprobanteOptions={creditNoteComprobanteOptions}
                            isComprobanteLocked
                            comprobanteHelpText="La nota de credito se emite con el tipo correspondiente al comprobante original."
                            showIvaFields={shouldShowCreditNoteIvaFields}
                            cancelLabel="Cancelar"
                            confirmLabel="Generar Nota de Credito"
                            onCancel={() => {
                                setIsCreditNotePreviewOpen(false);
                                setCreditNotePreview(null);
                            }}
                            onConfirm={handleConfirmCreateCreditNote}
                            isSubmitting={isGeneratingCreditNote}
                        />
                    )}
                </Modal>
            </FadeIn>
        </Layout>
    );
};

export default FiscalDocuments;
