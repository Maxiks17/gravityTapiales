import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, FileText, Eye, FileDown, Printer, ChevronDown, Check } from 'lucide-react';
import { exportToCSV, exportToPDF } from '../utils/exportUtils';
import { useNavigate } from 'react-router-dom';
import { orderService, type Order } from '../services/orderService';
import { tenantService } from '../services/tenantService';
import { fiscalDocumentService } from '../services/fiscalDocumentService';
import { fiscalConditionService, type FiscalCondition } from '../services/fiscalConditionService';
import { categoryService } from '../services/categoryService';
import { useOperationMode } from '../hooks/useOperationMode';
import { Button } from '../components/ui/Button';
import LoadingPlaceholder from '../components/ui/LoadingPlaceholder';
import { taxRateTypeService } from '../services/taxRateTypeService';

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
import { Modal } from '../components/ui/Modal';
import SearchBar from '../components/ui/SearchBar';
import Layout from '../components/layout/Layout';
import { useToast } from '../context/ToastContext';
import { useTenant } from '../context/TenantContext';
import { useServerPagination } from '../hooks/useServerPagination';
import afipService, { type InvoicePayload } from '../services/afipService';
import { TipoComprobante, TipoDocumento } from '../services/afip/constants';
import pageStyles from '../styles/page-layout.module.css';
import moduleStyles from './Orders.module.css';
const styles = { ...pageStyles, ...moduleStyles }; import clsx from 'clsx';
import FadeIn from '../components/ui/FadeIn';
import { customerService } from '@/services/customerService';
import FiscalVoucherPreviewForm, { type VoucherPreviewFormData } from '../components/fiscal/FiscalVoucherPreviewForm';

interface InvoicePreviewState extends VoucherPreviewFormData {
    orderId: string;
    customerId: string;
    tipoConcepto: number;
    ambiente: number;
    moneda: string;
    cotizacion: number;
    fechaComprobante: string;
}

const COMPROBANTE_OPTIONS = [
    { value: TipoComprobante.FacturaA, label: 'Factura A' },
    { value: TipoComprobante.FacturaB, label: 'Factura B' },
    { value: TipoComprobante.FacturaC, label: 'Factura C' },
    { value: TipoComprobante.FacturaE, label: 'Factura E' },
];

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

const RESPONSABLE_INSCRIPTO_IDS = new Set<number>([1, 11]);
const MONOTRIBUTO_IDS = new Set<number>([6, 13, 16]);
const CONSUMIDOR_FINAL_IDS = new Set<number>([5]);
const EXENTO_IDS = new Set<number>([4]);

const Orders: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { currentTenant } = useTenant();
    const { operationMode, requiresDeliveryConfirmation } = useOperationMode();
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

    const [statusMenuOpen, setStatusMenuOpen] = useState<string | null>(null);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const [, setSelectedOrder] = useState<Order | null>(null);

    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [orderDetails, setOrderDetails] = useState<any>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [fiscalConditions, setFiscalConditions] = useState<FiscalCondition[]>([]);
    const [isInvoicePreviewOpen, setIsInvoicePreviewOpen] = useState(false);
    const [isPreparingInvoice, setIsPreparingInvoice] = useState(false);
    const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
    const [invoicePreview, setInvoicePreview] = useState<InvoicePreviewState | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    const isIssuerFacturaCOnly = useMemo(() => {
        const settings = currentTenant?.settings || {};
        const taxpayerTypeRaw = String(settings.afip_taxpayer_type || '').trim().toLowerCase();
        const taxpayerTypeNormalized = taxpayerTypeRaw
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[\s-]+/g, '_');

        const byType = taxpayerTypeNormalized === 'consumidor_final' || taxpayerTypeNormalized === 'monotributo';
        const byFiscalId = Number(settings.condicion_fiscal_id || 0) === 5;

        return byType || byFiscalId;
    }, [currentTenant]);

    const isIssuerResponsableInscripto = useMemo(() => {
        const settings = currentTenant?.settings || {};
        const taxpayerTypeRaw = String(settings.afip_taxpayer_type || '').trim().toLowerCase();
        const taxpayerTypeNormalized = taxpayerTypeRaw
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[\s-]+/g, '_');

        const byType = taxpayerTypeNormalized === 'responsable_inscripto';
        const byFiscalId = RESPONSABLE_INSCRIPTO_IDS.has(Number(settings.condicion_fiscal_id || 0));

        return byType || byFiscalId;
    }, [currentTenant]);

    const getAllowedComprobanteValues = (receptorCondicionFiscalId?: number): number[] => {
        if (isIssuerFacturaCOnly) {
            return [TipoComprobante.FacturaC];
        }

        const receptorId = Number(receptorCondicionFiscalId || 0);
        const receptorEsResponsableInscripto = RESPONSABLE_INSCRIPTO_IDS.has(receptorId);
        const receptorPermiteFacturaB =
            MONOTRIBUTO_IDS.has(receptorId) ||
            CONSUMIDOR_FINAL_IDS.has(receptorId) ||
            EXENTO_IDS.has(receptorId);

        const values: number[] = [TipoComprobante.FacturaC];

        if (isIssuerResponsableInscripto && receptorEsResponsableInscripto) {
            values.unshift(TipoComprobante.FacturaA);
        }

        if (isIssuerResponsableInscripto && receptorPermiteFacturaB) {
            values.unshift(TipoComprobante.FacturaB);
        }

        return Array.from(new Set(values));
    };

    const availableComprobanteOptions = useMemo(() => {
        const allowedValues = getAllowedComprobanteValues(invoicePreview?.receptorCondicionFiscalId);
        return COMPROBANTE_OPTIONS.filter((opt) => allowedValues.includes(opt.value));
    }, [isIssuerFacturaCOnly, isIssuerResponsableInscripto, invoicePreview?.receptorCondicionFiscalId]);

    useEffect(() => {
        if (!invoicePreview) return;

        const allowedValues = getAllowedComprobanteValues(invoicePreview.receptorCondicionFiscalId);
        if (allowedValues.length === 0) return;

        if (!allowedValues.includes(invoicePreview.tipoComprobante)) {
            setInvoicePreview((prev) => (prev
                ? {
                    ...prev,
                    tipoComprobante: allowedValues[0],
                }
                : prev
            ));
        }
    }, [invoicePreview?.receptorCondicionFiscalId, isIssuerFacturaCOnly, isIssuerResponsableInscripto]);

    const parseLong = (val: unknown) => {
        if (!val) return 0;
        const str = String(val).replace(/[^0-9]/g, '');
        return str ? Number(str) : 0;
    };

    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

    const parsePercentFromNombre = (nombre: unknown) => {
        const match = String(nombre ?? '').match(/(\d+(?:\.\d+)?)/);
        return match ? Number(match[1]) : 0;
    };

    const buildAmounts = (
        items: Array<{ quantity?: number; unit_price?: number; product?: { sale_price?: number; tax_rate?: number } }>,
        tipoComprobante: number,
        taxRateTypePercentById: Map<number, number>
    ) => {
        const ivaBuckets = new Map<number, { baseImponible: number; importe: number }>();

        const totals = items.reduce(
            (acc, item) => {
                const quantity = Number(item?.quantity ?? 0);
                const salePrice = Number(item?.product?.sale_price ?? item?.unit_price ?? 0);
                const gross = salePrice * quantity;

                const taxRateTypeId = Number(item?.product?.tax_rate ?? 0);
                const percent = taxRateTypePercentById.get(taxRateTypeId) ?? 0;

                const iva = tipoComprobante === TipoComprobante.FacturaC ? 0 : gross * (percent / 100);
                const net = gross - iva;

                acc.importeTotal += gross;
                acc.importeNeto += net;
                acc.importeIVA += tipoComprobante === TipoComprobante.FacturaC ? 0 : iva;

                if (tipoComprobante !== TipoComprobante.FacturaC && taxRateTypeId && percent > 0) {
                    const bucket = ivaBuckets.get(taxRateTypeId) ?? { baseImponible: 0, importe: 0 };
                    bucket.baseImponible += net;
                    bucket.importe += iva;
                    ivaBuckets.set(taxRateTypeId, bucket);
                }
                return acc;
            },
            { importeTotal: 0, importeNeto: 0, importeIVA: 0 }
        );

        const ivaList = Array.from(ivaBuckets.entries())
            .map(([id, v]) => ({
                id,
                baseImponible: round2(v.baseImponible),
                importe: round2(v.importe),
            }))
            .filter((x) => x.importe > 0);

        const importeTotal = round2(totals.importeTotal);
        const importeNeto = round2(totals.importeNeto);
        const importeIVA = round2(totals.importeIVA);
        const importeTributo = Number((importeTotal - importeNeto).toFixed(2));

        return {
            importeTotal,
            importeNeto,
            importeIVA,
            importeTributo,
            ivaList,
        };
    };

    const orderDetailAmounts = useMemo(() => {
        if (!orderDetails) {
            return {
                subtotalAmount: 0,
                taxAmount: 0,
                discountLabel: '',
                discountAmount: 0,
                isDiscount: true,
                hasAdjustment: false,
            };
        }

        const items = Array.isArray(orderDetails.items) ? orderDetails.items : [];
        const subtotalFromItems = items.reduce(
            (sum: number, item: any) => sum + Number(item?.subtotal || 0),
            0
        );
        const totalFromItems = items.reduce(
            (sum: number, item: any) => sum + (Number(item?.unit_price || 0) * Number(item?.quantity || 0)),
            0
        );

        const subtotalAmount = items.length > 0
            ? subtotalFromItems
            : Number(orderDetails.subtotal ?? 0);
        const taxAmount = items.length > 0
            ? Math.max(0, totalFromItems - subtotalFromItems)
            : Number(orderDetails.tax_amount ?? 0);

        const discountAmount = Number(orderDetails.discount_amount ?? 0);
        const discountPercent = Number(orderDetails.discount_percent ?? 0);

        if (Number.isFinite(discountAmount) && Math.abs(discountAmount) > 0) {
            const formattedPercent = Number.isFinite(discountPercent) && discountPercent > 0
                ? ` (${discountPercent % 1 === 0 ? discountPercent.toFixed(0) : discountPercent.toFixed(2)}%)`
                : '';
            const isDiscount = discountAmount > 0;

            return {
                subtotalAmount,
                taxAmount,
                discountLabel: `${isDiscount ? 'Descuento' : 'Recargo'}${formattedPercent}:`,
                discountAmount: Math.abs(discountAmount),
                isDiscount,
                hasAdjustment: true,
            };
        }

        const legacyAdjustment = Number(orderDetails.applied_adjustment_value ?? 0);
        if (!Number.isFinite(legacyAdjustment) || legacyAdjustment === 0) {
            return {
                subtotalAmount,
                taxAmount,
                discountLabel: '',
                discountAmount: 0,
                isDiscount: true,
                hasAdjustment: false,
            };
        }

        const baseTotal = subtotalAmount + taxAmount;
        const adjustmentAmount = Math.abs((baseTotal * legacyAdjustment) / 100);
        const isDiscount = legacyAdjustment < 0;

        return {
            subtotalAmount,
            taxAmount,
            discountLabel: `${isDiscount ? 'Descuento' : 'Recargo'} (${legacyAdjustment}%):`,
            discountAmount: adjustmentAmount,
            isDiscount,
            hasAdjustment: true,
        };
    }, [orderDetails]);

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

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

    const {
        data: orders,
        loading,
        currentPage,
        totalPages,
        goToPage,
        nextPage,
        previousPage,
        hasNextPage,
        hasPreviousPage,
        refresh,
    } = useServerPagination({
        fetchFunction: (page, pageSize) => orderService.getPaginated(page, pageSize, debouncedSearchTerm),
        pageSize: 20,
        dependencies: [debouncedSearchTerm],
    });

    useEffect(() => {

        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Solo cerrar si el click no es dentro del menú o el botón de estado
            if (!target.closest(`.${styles.statusWrapper}`) && !target.closest(`.${styles.statusMenu}`)) {
                setStatusMenuOpen(null);
            }
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('click', handleClickOutside);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('click', handleClickOutside);
        };
    }, []);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        if (isMobile) {
            const day = date.getDate();
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = monthNames[date.getMonth()];
            return `${day} ${month}`;
        }
        return date.toLocaleDateString();
    };

    const formatOrderNumber = (orderNumber: string) => {
        if (!isMobile || !orderNumber) return orderNumber;

        // Ejemplo: "ORD-123456789" -> "12...6789" (sin el prefijo ORD-)
        const parts = orderNumber.split('-');
        if (parts.length !== 2) return orderNumber;

        const number = parts[1];

        if (number.length <= 6) return number;

        const firstTwo = number.substring(0, 2);
        const lastFour = number.substring(number.length - 4);

        return `${firstTwo}...${lastFour}`;
    };

    const handleViewDetails = async (order: Order) => {
        setLoadingDetails(true);
        setIsDetailsModalOpen(true);
        try {
            const details = await orderService.getById(order.id);
            setOrderDetails(details);
        } catch (error: any) {
            console.error('Error loading order details:', error);
            showToast(error?.message || 'Failed to load order details.', 'error');
        } finally {
            setLoadingDetails(false);
        }
    };

    const handlePrintOrder = async (order: Order) => {
        try {
            if (!currentTenant) {
                showToast('No se ha seleccionado un tenant', 'error');
                return;
            }

            showToast('Preparando impresión...', 'info');
            
            // Fetch full order details to get items
            const fullOrder = await orderService.getById(order.id);
            
            if (!fullOrder || !fullOrder.items || fullOrder.items.length === 0) {
                showToast('La orden no tiene items para imprimir', 'error');
                return;
            }

            const settings = await tenantService.getSettings(currentTenant.id);
            const printEndpoint = settings.print_endpoint;

            if (!printEndpoint) {
                showToast('No hay endpoint de impresión configurado', 'error');
                return;
            }

            const printSeparateByCategory = settings.print_separate_by_category === 'true' || settings.print_separate_by_category === true;

            let ticketCount = 0;
            // 1. Siempre imprimir un ticket con todos los productos
            const mainPrintPayload = {
                nombreEmpresa: currentTenant.name,
                fecha: new Date(fullOrder.order_date).toISOString(),
                numeroComprobante: fullOrder.order_number,
                tipoComprobante: "TICKET",
                items: fullOrder.items.map((item: any) => ({
                    name: item.product?.name || 'Producto',
                    quantity: item.quantity,
                    price: item.unit_price
                })),
                total: fullOrder.total_amount,
                pieDePagina: "Gracias por su compra"
            };

            await fetch(printEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(mainPrintPayload)
            });
            ticketCount++;

            // Pequeño delay antes de imprimir tickets por categoría
            if (printSeparateByCategory) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // 2. Si está habilitada la opción, imprimir tickets adicionales por categoría
            if (printSeparateByCategory) {
                // Obtener todas las categorías para verificar print_separately
                const allCategories = await categoryService.getAll();

                // Agrupar items por categoría
                const itemsByCategory = new Map<string, any[]>();
                fullOrder.items.forEach((item: any) => {
                    const categoryId = item.product?.category_id || 'sin-categoria';
                    if (!itemsByCategory.has(categoryId)) {
                        itemsByCategory.set(categoryId, []);
                    }
                    itemsByCategory.get(categoryId)!.push(item);
                });

                // Enviar un ticket por cada categoría que tenga print_separately habilitado
                for (const [categoryId, categoryItems] of itemsByCategory) {
                    const category = allCategories.find(c => c.id === categoryId);
                    
                    // Solo imprimir si la categoría tiene print_separately explícitamente habilitado
                    if (!category || category.print_separately !== true) {
                        continue;
                    }

                    const categoryName = category?.name || 'Sin Categoría';

                    const printPayload = {
                        nombreEmpresa: currentTenant.name,
                        fecha: new Date(fullOrder.order_date).toISOString(),
                        numeroComprobante: fullOrder.order_number,
                        tipoComprobante: "TICKET",
                        categoria: categoryName,
                        items: categoryItems.map((item: any) => ({
                            name: item.product?.name || 'Producto',
                            quantity: item.quantity,
                            price: item.unit_price || item.product?.sale_price || 0
                        })),
                        total: fullOrder.total_amount,
                        pieDePagina: "Gracias por su compra"
                    };

                    await fetch(printEndpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(printPayload)
                    });

                    ticketCount++;
                }
            }

            showToast(`${ticketCount} ticket${ticketCount > 1 ? 's' : ''} enviado${ticketCount > 1 ? 's' : ''} a imprimir`, 'success');

        } catch (error) {
            console.error('Error printing order:', error);
            showToast('Error al imprimir el ticket', 'error');
        }
    };

    const handleGenerateInvoice = async (order: Order) => {
        try {
            if (!currentTenant?.settings) {
                showToast('Error: No se encontraron configuraciones del tenant', 'error');
                return;
            }

            if (!order.customer_id) {
                showToast('Error: La orden no tiene cliente asociado', 'error');
                return;
            }

            setIsPreparingInvoice(true);

            const settings = currentTenant.settings;
            const customer = await customerService.getById(order.customer_id);
            const fullOrder = await orderService.getById(order.id);

            type OrderItemForInvoice = {
                quantity?: number;
                unit_price?: number;
                product?: {
                    sale_price?: number;
                    tax_rate?: number;
                };
            };

            const items = (fullOrder?.items || []) as OrderItemForInvoice[];
            const taxRateTypes = await taxRateTypeService.getAll();
            const taxRateTypePercentById = new Map<number, number>();
            for (const t of taxRateTypes) {
                taxRateTypePercentById.set(t.id, parsePercentFromNombre(t.nombre));
            }

            const tipoComprobanteDefault = TipoComprobante.FacturaC;
            const amounts = buildAmounts(items, tipoComprobanteDefault, taxRateTypePercentById);

            const rawCustomerDoc = String(customer.document_number || '').replace(/\D/g, '');
            const customerDocType = Number(customer.document_type || TipoDocumento.SinIdentificar_Exterior);

            setInvoicePreview({
                orderId: fullOrder.id,
                customerId: fullOrder.customer_id || order.customer_id,
                emisorRazonSocial: String(settings.company_name || currentTenant.name || ''),
                emisorCuit: String(settings.company_cuit || ''),
                receptorRazonSocial: customer.business_name || 'Consumidor Final',
                receptorCondicionFiscalId: Number(customer.condicion_fiscal_id || 0),
                receptorTipoDocumento: customerDocType,
                receptorNumeroDocumento: rawCustomerDoc,
                tipoComprobante: tipoComprobanteDefault,
                tipoConcepto: 1,
                ambiente: settings.afip_environment === 'production' ? 1 : 2,
                puntoVenta: parseLong(settings.afip_punto_venta),
                moneda: 'PES',
                cotizacion: 1,
                fechaComprobante: new Date().toISOString(),
                importeTotal: amounts.importeTotal,
                importeNeto: amounts.importeNeto,
                importeIVA: amounts.importeIVA,
                importeTributo: amounts.importeTributo,
                ivaList: amounts.ivaList,
            });

            setIsInvoicePreviewOpen(true);
        } catch (error) {
            console.error('Error preparing invoice preview:', error);
            showToast('No se pudo preparar la previsualizacion de la factura', 'error');
        } finally {
            setIsPreparingInvoice(false);
        }
    };

    const handleConfirmGenerateInvoice = async () => {
        if (!invoicePreview) return;

        try {
            setIsGeneratingInvoice(true);

            const cuit = parseLong(invoicePreview.emisorCuit);
            if (!cuit) {
                showToast('Error: CUIT del emisor invalido', 'error');
                return;
            }

            const puntoVenta = parseLong(invoicePreview.puntoVenta);
            if (!puntoVenta) {
                showToast('Error: Punto de venta invalido', 'error');
                return;
            }

            const receptorDocDigits = String(invoicePreview.receptorNumeroDocumento || '').replace(/\D/g, '');

            const tipoDocCliente = Number(invoicePreview.receptorTipoDocumento || TipoDocumento.SinIdentificar_Exterior);
            const dniCliente = Number(receptorDocDigits || 0);

            const allowedComprobantes = getAllowedComprobanteValues(invoicePreview.receptorCondicionFiscalId);
            let tipoComprobanteFinal = Number(invoicePreview.tipoComprobante);

            if (!allowedComprobantes.includes(tipoComprobanteFinal)) {
                tipoComprobanteFinal = allowedComprobantes[0] ?? TipoComprobante.FacturaC;
                showToast('Se ajusto el tipo de comprobante segun la condicion fiscal del emisor/receptor.', 'info');
            }

            const isFacturaConIvaDiscriminado =
                tipoComprobanteFinal === TipoComprobante.FacturaA ||
                tipoComprobanteFinal === TipoComprobante.FacturaB;


            const payload: InvoicePayload = {
                ambiente: Number(invoicePreview.ambiente),
                cuit,
                puntoVenta,
                numeroComprobante: 0,
                tipoComprobante: tipoComprobanteFinal,
                tipoConcepto: Number(invoicePreview.tipoConcepto),
                tipoDocCliente,
                dniCliente,
                importeTotal: Number(invoicePreview.importeTotal),
                importeNeto: Number(invoicePreview.importeNeto),
                importeTributo: isFacturaConIvaDiscriminado ? Number(invoicePreview.importeTributo) : 0,
                importeIVA: isFacturaConIvaDiscriminado ? Number(invoicePreview.importeIVA) : 0,
                moneda: String(invoicePreview.moneda || 'PES'),
                cotizacion: Number(invoicePreview.cotizacion || 1),
                ivaList: isFacturaConIvaDiscriminado ? invoicePreview.ivaList : [],
                fechaComprobante: invoicePreview.fechaComprobante || new Date().toISOString(),
                puntoDeVentaOriginal: puntoVenta,
            };
            
            const facturaRes = await afipService.generateInvoice(payload);
            console.log('facturaRes', facturaRes);
            const resultado = facturaRes.response.resultado;
            const cae = facturaRes.response.cae;

            if (resultado !== 'A' || !cae) {
                const obs = facturaRes.response.observacion;
                const msg = obs
                    ? `AFIP rechazo la factura: ${obs}`
                    : `AFIP rechazo la factura (resultado: ${resultado})`;
                console.error('AFIP response:', facturaRes);
                showToast(msg, 'error', 9000);
                return;
            }

            const caeFchVto = facturaRes.response.caeFchVto;
            const caeExpDate = caeFchVto && caeFchVto.length === 8
                ? `${caeFchVto.slice(0, 4)}-${caeFchVto.slice(4, 6)}-${caeFchVto.slice(6, 8)}T00:00:00Z`
                : undefined;

            await fiscalDocumentService.create(
                {
                    customer_id: invoicePreview.customerId,
                    order_id: invoicePreview.orderId,
                    total_amount: Number(invoicePreview.importeTotal),
                    fdoc_number: facturaRes.response.comprobanteDescripcion,
                    fdoc_date: payload.fechaComprobante,
                    due_date: payload.fechaComprobante,
                    status: 'Aprobada',
                    cae,
                    cae_expiration_date: caeExpDate,
                    punto_de_venta: puntoVenta,
                    tipo_comprobante: payload.tipoComprobante,
                    numero_comprobante: facturaRes.response.comprobanteNro,
                },
                {
                    taxDetails: invoicePreview.ivaList.map((item) => ({
                        tax_rate_type_id: item.id,
                        base_amount: item.baseImponible,
                        tax_amount: item.importe,
                        total_amount: item.baseImponible + item.importe,
                    })),
                }
            );

            setIsInvoicePreviewOpen(false);
            setInvoicePreview(null);
            showToast('Comprobante generado exitosamente', 'success');
            setTimeout(() => navigate('/fiscal-documents'), 1000);
        } catch (error) {
            console.error('Error generating invoice:', error);
            showToast(`Hubo un error al generar el comprobante: ${error}`, 'error', 9000);
        } finally {
            setIsGeneratingInvoice(false);
        }
    };

    const handleStatusClick = (order: Order, e: React.MouseEvent) => {
        e.stopPropagation();
        if (statusMenuOpen === order.id) {
            setStatusMenuOpen(null);
        } else {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setMenuPosition({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX
            });
            setStatusMenuOpen(order.id);
            setSelectedOrder(order);
        }
    };

    const handleStatusUpdate = async (orderId: string, newStatus: string) => {
        try {
            await orderService.updateStatus(orderId, newStatus);
            refresh();
            setStatusMenuOpen(null);
            showToast('¡Estado del pedido actualizado exitosamente!', 'success');
        } catch (error: any) {
            console.error('Error updating status:', error);
            showToast(error?.message || 'Error al actualizar el estado.', 'error');
        }
    };

    const translateStatus = (status: string) => {
        const translations: Record<string, string> = {
            'open': 'Abierto',
            'pending': 'Pendiente',
            'confirmed': 'Confirmado',
            'processing': 'Procesando',
            'shipped': 'Enviado',
            'delivered': 'Entregado',
            'completed': 'Completado',
            'cancelled': 'Cancelado'
        };
        return translations[status] || status;
    };

    const renderStatusMenu = (order: Order) => (
        <div className={styles.statusWrapper}>
            <button
                className={clsx(styles.status, styles[order.status])}
                onClick={(e) => handleStatusClick(order, e)}
                title="Haz clic para actualizar estado"
            >
                {translateStatus(order.status)}
                <ChevronDown size={14} />
            </button>
            {statusMenuOpen === order.id && createPortal(
                <div 
                    className={styles.statusMenu}
                    style={{
                        top: `${menuPosition.top}px`,
                        left: `${menuPosition.left}px`,
                        position: 'absolute',
                        zIndex: 9999
                    }}
                    onMouseEnter={(e) => e.stopPropagation()}
                    onMouseLeave={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                >
                    {operationMode === 'RESTAURANTE' && (
                        <div className={styles.statusOption} onClick={() => handleStatusUpdate(order.id, 'open')}>
                            <span className={clsx(styles.statusBadge, styles.open)}>Abierto</span>
                        </div>
                    )}
                    <div className={styles.statusOption} onClick={() => handleStatusUpdate(order.id, 'pending')}>
                        <span className={clsx(styles.statusBadge, styles.pending)}>Pendiente</span>
                    </div>
                    <div className={styles.statusOption} onClick={() => handleStatusUpdate(order.id, 'confirmed')}>
                        <span className={clsx(styles.statusBadge, styles.confirmed)}>Confirmado</span>
                    </div>
                    <div className={styles.statusOption} onClick={() => handleStatusUpdate(order.id, 'processing')}>
                        <span className={clsx(styles.statusBadge, styles.processing)}>Procesando</span>
                    </div>
                    <div className={styles.statusOption} onClick={() => handleStatusUpdate(order.id, 'shipped')}>
                        <span className={clsx(styles.statusBadge, styles.shipped)}>Enviado</span>
                    </div>
                    <div className={styles.statusOption} onClick={() => handleStatusUpdate(order.id, 'delivered')}>
                        <span className={clsx(styles.statusBadge, styles.delivered)}>Entregado</span>
                    </div>
                    <div className={styles.statusOption} onClick={() => handleStatusUpdate(order.id, 'completed')}>
                        <span className={clsx(styles.statusBadge, styles.completed)}>Completado</span>
                    </div>
                    <div className={styles.statusOption} onClick={() => handleStatusUpdate(order.id, 'cancelled')}>
                        <span className={clsx(styles.statusBadge, styles.cancelled)}>Cancelado</span>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );

    // Handle mark as delivered for DISTRIBUIDOR mode
    const handleMarkAsDelivered = async (order: Order) => {
        if (window.confirm(`¿Marcar el pedido ${order.order_number} como entregado?`)) {
            try {
                await orderService.markAsDelivered(order.id);
                showToast('¡Pedido marcado como entregado!', 'success');
                refresh();
            } catch (error: any) {
                console.error('Error marking as delivered:', error);
                showToast(error?.message || 'Error al actualizar el pedido.', 'error');
            }
        }
    };

    // Render quick action button for DISTRIBUIDOR mode
    const renderDeliveryAction = (order: Order) => {
        if (!requiresDeliveryConfirmation) return null;
        if (order.status !== 'pending') return null;

        return (
            <Button
                variant="ghost"
                size="sm"
                onClick={() => handleMarkAsDelivered(order)}
                title="Marcar como entregado"
                style={{ color: 'var(--color-success)' }}
            >
                <Check size={18} />
            </Button>
        );
    };

    const handleExportAll = async () => {
        const allOrders = await orderService.getAll();
        return allOrders;
    };

    return (
        <Layout title="Órdenes">
            <FadeIn>
                <div className={styles.container}>
                    <div className={styles.header}>
                        <div className={styles.headerActions}>
                            <SearchBar
                                value={searchTerm}
                                onChange={setSearchTerm}
                                placeholder="Buscar pedidos..."
                            />
                            <div className={styles.exportGroup}>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async () => {
                                        const allOrders = await handleExportAll();
                                        exportToCSV(
                                            allOrders.map(o => ({
                                            pedido: o.order_number,
                                            cliente: o.customer?.business_name || 'Desconocido',
                                            fecha: new Date(o.order_date).toLocaleDateString(),
                                            total: o.total_amount,
                                            estado: o.status
                                        })),
                                        'pedidos',
                                        [
                                            { header: 'Pedido #', key: 'pedido' },
                                            { header: 'Cliente', key: 'cliente' },
                                            { header: 'Fecha', key: 'fecha' },
                                            { header: 'Total', key: 'total' },
                                            { header: 'Estado', key: 'estado' }
                                        ]
                                        );
                                    }}
                                    title="Exportar a CSV"
                                >
                                    <FileText size={18} />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async () => {
                                        const allOrders = await handleExportAll();
                                        exportToPDF(
                                            allOrders.map(o => ({
                                            pedido: o.order_number,
                                            cliente: o.customer?.business_name || 'Desconocido',
                                            fecha: new Date(o.order_date).toLocaleDateString(),
                                            total: `$${o.total_amount.toFixed(2)}`,
                                            estado: o.status
                                        })),
                                        'pedidos',
                                        [
                                            { header: 'Pedido #', key: 'pedido' },
                                            { header: 'Cliente', key: 'cliente' },
                                            { header: 'Fecha', key: 'fecha' },
                                            { header: 'Total', key: 'total' },
                                            { header: 'Estado', key: 'estado' }
                                        ],
                                        'Listado de Pedidos',
                                        (error) => showToast(error, 'error')
                                        );
                                    }}
                                    title="Exportar a PDF"
                                >
                                    <FileDown size={18} />
                                </Button>
                            </div>
                            <Button onClick={() => navigate('/orders/new')} size="sm">
                                <Plus size={18} style={{ marginRight: '0.5rem' }} />
                                Nuevo Pedido
                            </Button>
                        </div>
                    </div>

                    {loading ? (
                        <LoadingPlaceholder />
                    ) : orders.length > 0 ? (
                        <div>
                            {!isMobile && (
                                <div className={styles.tableWrapper}>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Pedido #</TableHead>
                                                <TableHead>Cliente</TableHead>
                                                <TableHead>Fecha</TableHead>
                                                <TableHead>Total</TableHead>
                                                {operationMode === 'DISTRIBUIDOR' && <TableHead>Estado</TableHead>}
                                                <TableHead>Acciones</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {orders.map((order) => (
                                            <TableRow
                                                key={order.id}
                                                className="cursor-pointer"
                                                data-menu-open={statusMenuOpen === order.id ? 'true' : undefined}
                                            >
                                                <TableCell className="font-medium">
                                                    {formatOrderNumber(order.order_number)}
                                                </TableCell>
                                                <TableCell>
                                                    {order.customer?.business_name || 'Desconocido'}
                                                </TableCell>
                                                <TableCell>
                                                    {formatDate(order.order_date)}
                                                </TableCell>
                                                <TableCell>
                                                    ${order.total_amount.toFixed(2)}
                                                </TableCell>
                                                {operationMode === 'DISTRIBUIDOR' && (
                                                    <TableCell>
                                                        {renderStatusMenu(order)}
                                                    </TableCell>
                                                )}
                                                <TableCell>
                                                    <div className={styles.actions}>
                                                        {renderDeliveryAction(order)}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            title="Ver Detalles"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleViewDetails(order);
                                                            }}
                                                        >
                                                            <Eye size={16} />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            title="Imprimir Orden"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handlePrintOrder(order);
                                                            }}
                                                        >
                                                            <Printer size={16} />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            title="Generar Factura"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleGenerateInvoice(order);
                                                            }}
                                                        >
                                                            <FileText size={16} />
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
                                    {orders.map((order) => (
                                        <div key={order.id} className={styles.mobileCard}>
                                            <div className={styles.mobileCardHeader}>
                                                <div className={styles.mobileCardInfo}>
                                                    <h3 className={styles.mobileCardTitle}>{order.order_number}</h3>
                                                    <p className={styles.mobileCardSubtitle}>{order.customer?.business_name || 'Desconocido'}</p>
                                                </div>
                                            </div>
                                            <div className={styles.mobileCardDetails}>
                                                <div className={styles.mobileCardRow}>
                                                    <span className={styles.mobileCardLabel}>Fecha:</span>
                                                    <span className={styles.mobileCardValue}>{formatDate(order.order_date)}</span>
                                                </div>
                                                <div className={styles.mobileCardRow}>
                                                    <span className={styles.mobileCardLabel}>Total:</span>
                                                    <span className={styles.mobileCardPrice}>${order.total_amount.toFixed(2)}</span>
                                                </div>
                                                {operationMode === 'DISTRIBUIDOR' && (
                                                    <div className={styles.mobileCardRow}>
                                                        <span className={styles.mobileCardLabel}>Estado:</span>
                                                        <span className={clsx(styles.status, styles[order.status])}>
                                                            {order.status}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className={styles.mobileCardActions}>
                                                <Button variant="secondary" size="sm" onClick={() => handleViewDetails(order)}>
                                                    <Eye size={16} />
                                                    Ver
                                                </Button>
                                                <Button variant="secondary" size="sm" onClick={() => handlePrintOrder(order)}>
                                                    <Printer size={16} />
                                                    Imprimir
                                                </Button>
                                                <Button variant="secondary" size="sm" onClick={() => handleGenerateInvoice(order)}>
                                                    <FileText size={16} />
                                                    Factura
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
                                            
                                            {(() => {
                                                if (totalPages <= 7) {
                                                    // Mostrar todas las páginas si hay 7 o menos
                                                    return Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                                        <PaginationItem key={page}>
                                                            <PaginationLink
                                                                onClick={() => goToPage(page)}
                                                                isActive={currentPage === page}
                                                                className="cursor-pointer"
                                                            >
                                                                {page}
                                                            </PaginationLink>
                                                        </PaginationItem>
                                                    ));
                                                }

                                                const pages: (number | string)[] = [];
                                                
                                                // Primera página
                                                pages.push(1);
                                                
                                                // Calcular rango
                                                let startPage: number;
                                                let endPage: number;
                                                
                                                if (currentPage <= 3) {
                                                    startPage = 2;
                                                    endPage = 5;
                                                } else if (currentPage >= totalPages - 2) {
                                                    startPage = totalPages - 4;
                                                    endPage = totalPages - 1;
                                                } else {
                                                    startPage = currentPage - 1;
                                                    endPage = currentPage + 1;
                                                }
                                                
                                                // Ellipsis después de primera página
                                                if (startPage > 2) {
                                                    pages.push('ellipsis-start');
                                                }
                                                
                                                // Páginas del rango
                                                for (let i = startPage; i <= endPage; i++) {
                                                    if (i > 1 && i < totalPages) {
                                                        pages.push(i);
                                                    }
                                                }
                                                
                                                // Ellipsis antes de última página
                                                if (endPage < totalPages - 1) {
                                                    pages.push('ellipsis-end');
                                                }
                                                
                                                // Última página
                                                if (totalPages > 1) {
                                                    pages.push(totalPages);
                                                }
                                                
                                                return pages.map((page) => 
                                                    typeof page === 'string' ? (
                                                        <PaginationItem key={page}>
                                                            <span className="px-4 py-2">...</span>
                                                        </PaginationItem>
                                                    ) : (
                                                        <PaginationItem key={page}>
                                                            <PaginationLink
                                                                onClick={() => goToPage(page)}
                                                                isActive={currentPage === page}
                                                                className="cursor-pointer"
                                                            >
                                                                {page}
                                                            </PaginationLink>
                                                        </PaginationItem>
                                                    )
                                                );
                                            })()}
                                            
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
                            No se encontraron pedidos.
                        </div>
                    )}



                    {/* Order Details Modal */}
                    <Modal
                        isOpen={isInvoicePreviewOpen}
                        onClose={() => {
                            if (!isGeneratingInvoice) {
                                setIsInvoicePreviewOpen(false);
                                setInvoicePreview(null);
                            }
                        }}
                        title={([TipoComprobante.NotaCreditoA, TipoComprobante.NotaCreditoB, TipoComprobante.NotaCreditoC, TipoComprobante.NotaCreditoE] as number[]).includes(invoicePreview?.tipoComprobante ?? -1)
                            ? 'Generación de nota de crédito'
                            : 'Generación de Factura'
                        }
                    >
                        {isPreparingInvoice || !invoicePreview ? (
                            <LoadingPlaceholder />
                        ) : (
                            <FiscalVoucherPreviewForm
                                data={invoicePreview}
                                onChange={(updater) => setInvoicePreview((prev) => (prev ? updater(prev) : prev))}
                                fiscalConditions={fiscalConditions}
                                documentOptions={DOCUMENTO_OPTIONS}
                                comprobanteOptions={availableComprobanteOptions}
                                isComprobanteLocked={isIssuerFacturaCOnly}
                                comprobanteHelpText={isIssuerFacturaCOnly
                                    ? 'Por condicion fiscal del emisor, solo se permite Factura C.'
                                    : 'Factura A: solo emisor y receptor Responsable Inscripto. Factura B: emisor Responsable Inscripto y receptor Monotributista/Consumidor Final/Exento.'}
                                showIvaFields={invoicePreview.tipoComprobante === TipoComprobante.FacturaA || invoicePreview.tipoComprobante === TipoComprobante.FacturaB}
                                cancelLabel="Cancelar"
                                confirmLabel="Generar Factura"
                                onCancel={() => {
                                    setIsInvoicePreviewOpen(false);
                                    setInvoicePreview(null);
                                }}
                                onConfirm={handleConfirmGenerateInvoice}
                                isSubmitting={isGeneratingInvoice}
                            />
                        )}
                    </Modal>

                    {/* Order Details Modal */}
                    <Modal
                        isOpen={isDetailsModalOpen}
                        onClose={() => setIsDetailsModalOpen(false)}
                        title={`Detalles del Pedido - ${orderDetails?.order_number || ''}`}
                    >
                        {loadingDetails ? (
                            <LoadingPlaceholder />
                        ) : orderDetails ? (
                            <div className={styles.detailsModal}>
                                <div className={styles.detailsSection}>
                                    <h3>Información del Cliente</h3>
                                    <p><strong>Nombre:</strong> {orderDetails.customer?.business_name}</p>
                                    <p><strong>Correo Electrónico:</strong> {orderDetails.customer?.email}</p>
                                    <p><strong>Teléfono:</strong> {orderDetails.customer?.phone}</p>
                                </div>

                                <div className={styles.detailsSection}>
                                    <h3>Artículos del Pedido</h3>
                                    <table className={styles.itemsTable}>
                                        <thead>
                                            <tr>
                                                <th>Producto</th>
                                                <th>Cantidad</th>
                                                <th>Precio Unitario</th>
                                                <th>Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {orderDetails.items && orderDetails.items.length > 0 ? (
                                                orderDetails.items.map((item: any) => (
                                                    <tr key={item.id}>
                                                        <td>{item.product?.name || 'Producto Desconocido'}</td>
                                                        <td>{item.quantity}</td>
                                                        <td>${item.unit_price?.toFixed(2) || '0.00'}</td>
                                                        <td>${((item.unit_price || 0) * (item.quantity || 0)).toFixed(2)}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={4} style={{ textAlign: 'center', padding: 'var(--spacing-lg)', color: 'var(--color-text-muted)' }}>
                                                        No se encontraron artículos
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                <div className={styles.detailsSection}>
                                    <div className={styles.totalRow}>
                                        <span>Subtotal (antes de descuento):</span>
                                        <span>${orderDetailAmounts.subtotalAmount.toFixed(2)}</span>
                                    </div>
                                    <div className={styles.totalRow}>
                                        <span>IVA (antes de descuento):</span>
                                        <span>${orderDetailAmounts.taxAmount.toFixed(2)}</span>
                                    </div>
                                    <div className={styles.totalRow}>
                                        <span>Total antes de descuento:</span>
                                        <span>${(orderDetailAmounts.subtotalAmount + orderDetailAmounts.taxAmount).toFixed(2)}</span>
                                    </div>
                                    {orderDetailAmounts.hasAdjustment && (
                                        <div className={styles.totalRow}>
                                            <span>{orderDetailAmounts.discountLabel}</span>
                                            <span>
                                                {orderDetailAmounts.isDiscount ? '-' : '+'}${orderDetailAmounts.discountAmount.toFixed(2)}
                                            </span>
                                        </div>
                                    )}
                                    <div className={styles.totalRow} style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                                        <span>Total:</span>
                                        <span>${orderDetails.total_amount.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </Modal>
                </div>
            </FadeIn>
        </Layout>
    );
};

export default Orders;
