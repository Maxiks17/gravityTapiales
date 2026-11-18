import type { Order } from '../services/orderService';
import { tenantService } from '../services/tenantService';

/**
 * Configuración de impresión
 */
const DEFAULT_PRINT_ENDPOINT = 'http://localhost:3001/imprimirTicket';

/**
 * Obtiene el endpoint de impresión desde la configuración
 */
const getPrintEndpoint = async (tenantId: string): Promise<string> => {
    try {
        const settings = await tenantService.getSettings(tenantId);
        return settings.print_endpoint || DEFAULT_PRINT_ENDPOINT;
    } catch (error) {
        console.error('Error loading print endpoint:', error);
        return DEFAULT_PRINT_ENDPOINT;
    }
};

/**
 * Imprime una orden enviando los datos a un servicio de impresión local
 * @param order - Orden completa con items y customer
 */
export const printOrder = async (order: Order): Promise<void> => {
    try {
        if (!order.tenant_id) {
            console.warn('Order missing tenant_id, attempting to use default/current user tenant');
            // Fallback logic could go here, but for now let's warn
        }

        // Use tenant_id from order, or try to find a fallback if we really need to (e.g. fetch current user's tenant)
        // For robust code, let's fetch current user's tenant if order.tenant_id is missing
        let tenantId = order.tenant_id;
        if (!tenantId) {
            const tenant = await tenantService.getUserPrimaryTenant();
            tenantId = tenant?.id;
        }

        if (!tenantId) {
            throw new Error('No se pudo determinar el tenant para la impresión');
        }

        // Obtener el endpoint de impresión
        const endpoint = await getPrintEndpoint(tenantId);

        // Obtener nombre de la tienda desde settings
        const settings = await tenantService.getSettings(tenantId);
        const storeName = settings.company_name || 'Mi Tienda';

        // Preparar items para el formato del servicio de impresión
        const items = (order.items || []).map((item: any) => ({
            name: item.product?.name || 'Producto',
            quantity: item.quantity,
            price: item.unit_price
        }));

        // Preparar el payload
        const payload = {
            storeName: storeName,
            ticketNumber: order.order_number,
            items: items,
            total: order.total_amount
        };

        // Enviar la solicitud al servicio de impresión
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload),
            mode: 'cors'
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Sin detalles');
            throw new Error(`Error del servidor de impresión (${response.status}): ${errorText}`);
        }

    } catch (error) {
        console.error('Error al imprimir:', error);

        if (error instanceof TypeError) {
            if (error.message.includes('Failed to fetch')) {
                throw new Error(
                    'No se pudo conectar con el servicio de impresión.\n\n' +
                    'Verifica que:\n' +
                    '1. La aplicación de impresión esté ejecutándose\n' +
                    '2. El endpoint configurado sea correcto\n' +
                    '3. No haya un bloqueador de anuncios bloqueando la petición\n' +
                    '4. El servicio tenga CORS habilitado'
                );
            }
        }

        throw error;
    }
};

export interface CashRegisterCloseData {
    nombreEmpresa: string;
    fecha: string;
    numeroCierre: number;
    itemsCategorias: { name: string; total: number }[];
    itemsMetodoPago: { name: string; total: number }[];
    total: number;
    tenantId?: string;
}

/**
 * Imprime el cierre de caja enviando los datos a un servicio de impresión local
 * @param data - Datos del cierre de caja
 */
export const printCashRegisterClose = async (data: CashRegisterCloseData): Promise<void> => {
    try {
        let tenantId = data.tenantId;
        if (!tenantId) {
            const tenant = await tenantService.getUserPrimaryTenant();
            tenantId = tenant?.id;
        }

        if (!tenantId) {
            throw new Error('No se pudo determinar el tenant para la impresión');
        }

        // Obtener el endpoint de impresión configurado (ticket)
        const ticketEndpoint = await getPrintEndpoint(tenantId);
        
        // Derivar el endpoint de cierre de caja
        let endpoint: string;
        try {
            const url = new URL(ticketEndpoint);
            if (url.pathname.includes('imprimirTicket')) {
                endpoint = ticketEndpoint.replace('imprimirTicket', 'imprimircierrecaja');
            } else {
                url.pathname = '/imprimircierrecaja';
                endpoint = url.toString();
            }
        } catch (e) {
            endpoint = 'http://localhost:3001/imprimircierrecaja';
        }

        const payload = {
            nombreEmpresa: data.nombreEmpresa,
            fecha: data.fecha,
            numeroCierre: data.numeroCierre,
            itemsCategorias: data.itemsCategorias,
            itemsMetodoPago: data.itemsMetodoPago,
            total: data.total
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload),
            mode: 'cors'
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Sin detalles');
            throw new Error(`Error del servidor de impresión (${response.status}): ${errorText}`);
        }

    } catch (error) {
        console.error('Error al imprimir cierre de caja:', error);

        if (error instanceof TypeError) {
            if (error.message.includes('Failed to fetch')) {
                throw new Error(
                    'No se pudo conectar con el servicio de impresión.\n\n' +
                    'Verifica que:\n' +
                    '1. La aplicación de impresión esté ejecutándose\n' +
                    '2. El endpoint configurado sea correcto\n' +
                    '3. No haya un bloqueador de anuncios bloqueando la petición\n' +
                    '4. El servicio tenga CORS habilitado'
                );
            }
        }

        throw error;
    }
};
