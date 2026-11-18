import { supabase } from './supabaseClient';
import type { PaginationResponse } from '../hooks/useServerPagination';
import type { OperationMode, OrderLifecycleStatus } from '../types/operationMode';
import { OperationModeDefaults } from '../types/operationMode';

export interface Order {
    id: string;
    order_number: string;
    customer_id: string | null;
    table_id: string | null;
    order_date: string;
    delivery_date?: string;
    status: OrderLifecycleStatus;
    total_amount: number;
    subtotal: number;
    tax_amount: number;
    discount_amount?: number;
    discount_percent?: number;
    customer?: {
        business_name: string;
    };
    table?: {
        name: string;
    };
    items?: any[];
    tenant_id?: string;
}

export const orderService = {
    async getAll() {
        const { data, error } = await supabase
            .from('orders')
            .select('*, customer:customers(business_name)')
            .order('order_date', { ascending: false });

        if (error) throw error;
        return data as Order[];
    },

    async getPaginated(page: number = 1, pageSize: number = 10, searchTerm: string = ''): Promise<PaginationResponse<Order>> {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        // Si hay búsqueda, primero buscar por número de pedido
        if (searchTerm) {
            // Búsqueda por número de pedido
            const { data: orderData, error: orderError, count: orderCount } = await supabase
                .from('orders')
                .select('*, customer:customers(business_name)', { count: 'exact' })
                .ilike('order_number', `%${searchTerm}%`)
                .order('order_date', { ascending: false })
                .range(from, to);

            if (orderError) throw orderError;

            // Si encontramos resultados por número de pedido, retornarlos
            if (orderData && orderData.length > 0) {
                return {
                    data: orderData as Order[],
                    total: orderCount || 0,
                    page,
                    pageSize,
                    totalPages: Math.ceil((orderCount || 0) / pageSize),
                };
            }

            // Si no encontramos por número, buscar por nombre de cliente
            const { data: customerOrders, error: customerError } = await supabase
                .from('customers')
                .select('id')
                .ilike('business_name', `%${searchTerm}%`);

            if (customerError) throw customerError;

            if (customerOrders && customerOrders.length > 0) {
                const customerIds = customerOrders.map(c => c.id);
                
                const { data: ordersByCustomer, error: ordersError, count: customersOrderCount } = await supabase
                    .from('orders')
                    .select('*, customer:customers(business_name)', { count: 'exact' })
                    .in('customer_id', customerIds)
                    .order('order_date', { ascending: false })
                    .range(from, to);

                if (ordersError) throw ordersError;

                return {
                    data: ordersByCustomer as Order[],
                    total: customersOrderCount || 0,
                    page,
                    pageSize,
                    totalPages: Math.ceil((customersOrderCount || 0) / pageSize),
                };
            }

            // Si no se encontró nada, retornar vacío
            return {
                data: [],
                total: 0,
                page,
                pageSize,
                totalPages: 0,
            };
        }

        // Sin búsqueda, traer todos los pedidos paginados
        const { count } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true });

        const { data, error } = await supabase
            .from('orders')
            .select('*, customer:customers(business_name)')
            .order('order_date', { ascending: false })
            .range(from, to);

        if (error) throw error;

        return {
            data: data as Order[],
            total: count || 0,
            page,
            pageSize,
            totalPages: Math.ceil((count || 0) / pageSize),
        };
    },

    async getById(id: string) {
        const { data, error } = await supabase
            .from('orders')
            .select('*, customer:customers(*), items:order_items(*, product:products(*))')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    },

    async updateStatus(id: string, status: string) {
        const { data, error } = await supabase
            .from('orders')
            .update({ status })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async create(orderData: any) {
        // Generar número de orden único
        const { count } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true });

        const orderNumber = ((count || 0) + 1).toString();

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                order_number: orderNumber,
                customer_id: orderData.customer_id || null,
                table_id: orderData.table_id || null,
                order_date: orderData.order_date,
                status: orderData.status,
                subtotal: orderData.subtotal,
                tax_amount: orderData.tax_amount,
                total_amount: orderData.total_amount,
                discount_amount: orderData.discount_amount || 0,
                discount_percent: orderData.discount_percent || 0,
            })
            .select()
            .single();

        if (orderError) throw orderError;

        const items = orderData.items.map((item: any) => ({
            order_id: order.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.subtotal
        }));

        const { error: itemsError } = await supabase
            .from('order_items')
            .insert(items);

        if (itemsError) throw itemsError;

        return order;
    },

    /**
     * Create order based on operation mode
     * RESTAURANTE: Creates order with table_id and status 'open'
     * KIOSCO: Creates order with status 'completed' immediately
     * DISTRIBUIDOR: Creates order with status 'pending'
     */
    async createByMode(
        orderData: {
            customer_id?: string | null;
            table_id?: string | null;
            items: any[];
            subtotal: number;
            tax_amount: number;
            total_amount: number;
            discount_amount?: number;
            discount_percent?: number;
            notes?: string;
            payments?: { payment_method_id: string; amount: number }[];
            payment_method_id?: string; // DEPRECATED - use payments instead
        },
        operationMode: OperationMode
    ) {
        const modeConfig = OperationModeDefaults[operationMode];

        const { count } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true });

        const orderNumber = ((count || 0) + 1).toString();

        // For backward compatibility, use first payment method if payments provided
        const legacyPaymentMethodId = orderData.payments?.[0]?.payment_method_id
            || orderData.payment_method_id
            || null;

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                order_number: orderNumber,
                customer_id: orderData.customer_id || null,
                table_id: orderData.table_id || null,
                order_date: new Date().toISOString(),
                status: modeConfig.defaultOrderStatus,
                subtotal: orderData.subtotal,
                tax_amount: orderData.tax_amount,
                total_amount: orderData.total_amount,
                discount_amount: orderData.discount_amount || 0,
                discount_percent: orderData.discount_percent || 0,
                notes: orderData.notes || null,
                payment_method_id: legacyPaymentMethodId,
            })
            .select()
            .single();

        if (orderError) throw orderError;

        if (orderData.items && orderData.items.length > 0) {
            const items = orderData.items.map((item: any) => ({
                order_id: order.id,
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                subtotal: item.subtotal
            }));

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(items);

            if (itemsError) throw itemsError;
        }

        // Insert order payments (mixed payments support)
        if (orderData.payments && orderData.payments.length > 0) {
            const paymentsToInsert = orderData.payments.map(p => ({
                order_id: order.id,
                payment_method_id: p.payment_method_id,
                amount: p.amount,
            }));

            const { error: paymentsError } = await supabase
                .from('order_payments')
                .insert(paymentsToInsert);

            if (paymentsError) throw paymentsError;
        }

        // Process stock deduction for completed orders
        if (modeConfig.defaultOrderStatus === 'completed') {
            await this.processStockDeduction(order.id);
        }

        return order;
    },

    async processStockDeduction(orderId: string) {
        try {
            const { data: user } = await supabase.auth.getUser();
            const { data: userTenant } = await supabase
                .from('user_tenants')
                .select('tenant_id')
                .eq('user_id', user.user?.id)
                .single();

            if (userTenant?.tenant_id) {
                const { error: stockError } = await supabase.rpc(
                    'process_sale_stock_deduction',
                    {
                        p_order_id: orderId,
                        p_tenant_id: userTenant.tenant_id,
                        p_user_id: user.user?.id || null,
                    }
                );

                if (stockError) {
                    console.error('Error processing stock deduction:', stockError);
                }
            }
        } catch (error) {
            console.error('Error in stock deduction:', error);
        }
    },

    /**
     * Add items to an existing order (for restaurant mode)
     */
    async addItemsToOrder(orderId: string, items: any[]) {
        const orderItems = items.map((item: any) => ({
            order_id: orderId,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.subtotal
        }));

        const { error } = await supabase
            .from('order_items')
            .insert(orderItems);

        if (error) throw error;

        // Recalculate order totals
        await this.recalculateOrderTotals(orderId);

        // Mark table as OCCUPIED when first item is added
        await this.markTableAsOccupiedIfNeeded(orderId);
    },

    /**
     * Mark table as OCCUPIED if it's still FREE and has items
     */
    async markTableAsOccupiedIfNeeded(orderId: string) {
        // Get order with table info
        const { data: order } = await supabase
            .from('orders')
            .select('table_id, tables!inner(status)')
            .eq('id', orderId)
            .single();

        if (!order?.table_id) return;

        // Check if table is still FREE
        const table = (order as any).tables;
        if (table?.status === 'FREE') {
            // Update table status to OCCUPIED
            await supabase
                .from('tables')
                .update({ status: 'OCCUPIED' })
                .eq('id', order.table_id);
        }
    },

    /**
     * Recalculate order totals based on items
     */
    async recalculateOrderTotals(orderId: string) {
        const { data: items, error: itemsError } = await supabase
            .from('order_items')
            .select('subtotal, quantity, unit_price')
            .eq('order_id', orderId);

        if (itemsError) throw itemsError;

        // El unit_price YA incluye IVA
        // subtotal es el item sin IVA (ya calculado correctamente en los items)
        // total = suma de (unit_price * quantity) con IVA incluido
        const subtotal = items?.reduce((sum, item) => sum + (item.subtotal || 0), 0) || 0;
        const totalAmount = items?.reduce((sum, item) => sum + (item.unit_price * item.quantity || 0), 0) || 0;

        // Actualizar la orden con los nuevos totales
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                subtotal,
                total_amount: totalAmount,
                tax_amount: totalAmount - subtotal, // Suponiendo que el impuesto es la diferencia
            })
            .eq('id', orderId);

        if (updateError) throw updateError;
    },

    /**
     * Mark order as delivered (for DISTRIBUIDOR mode)
     */
    async markAsDelivered(orderId: string) {
        return this.updateStatus(orderId, 'delivered');
    },

    /**
     * Complete/close an order
     */
    async completeOrder(orderId: string) {
        return this.updateStatus(orderId, 'completed');
    },

    /**
     * Get orders by table (for restaurant mode)
     */
    async getByTable(tableId: string) {
        const { data, error } = await supabase
            .from('orders')
            .select('*, customer:customers(business_name), items:order_items(*, product:products(*))')
            .eq('table_id', tableId)
            .eq('status', 'open')
            .maybeSingle();

        if (error) throw error;
        return data;
    },

    /**
     * Get pending orders (for DISTRIBUIDOR mode)
     */
    async getPendingOrders() {
        const { data, error } = await supabase
            .from('orders')
            .select('*, customer:customers(business_name)')
            .eq('status', 'pending')
            .order('order_date', { ascending: true });

        if (error) throw error;
        return data as Order[];
    },

    /**
     * Delete an order and its items
     */
    async delete(orderId: string) {
        // First delete order items
        const { error: itemsError } = await supabase
            .from('order_items')
            .delete()
            .eq('order_id', orderId);

        if (itemsError) throw itemsError;

        // Then delete the order
        const { error: orderError } = await supabase
            .from('orders')
            .delete()
            .eq('id', orderId);

        if (orderError) throw orderError;
    },

    /**
     * Delete all items from an order (useful for updating order items)
     */
    async deleteOrderItems(orderId: string) {
        const { error } = await supabase
            .from('order_items')
            .delete()
            .eq('order_id', orderId);

        if (error) throw error;
    },
};
