import { supabase } from './supabaseClient';
import { fiscalDocumentService } from './fiscalDocumentService';
import { orderService } from './orderService';
import type { Table, CreateTableInput, UpdateTableInput, TableStatus } from '../types/operationMode';

export const tableService = {
    /**
     * Get all tables for the current tenant
     */
    async getAll(): Promise<Table[]> {
        const { data, error } = await supabase
            .from('tables')
            .select('*')
            .eq('is_active', true)
            .order('name');

        if (error) throw error;
        return data as Table[];
    },

    /**
     * Get all tables with their current orders (for restaurant view)
     */
    async getAllWithOrders(): Promise<Table[]> {
        const { data: tables, error: tablesError } = await supabase
            .from('tables')
            .select('*')
            .eq('is_active', true)
            .order('name');

        if (tablesError) throw tablesError;

        // Get all table IDs to check for open orders
        const allTableIds = (tables as Table[]).map(t => t.id);

        if (allTableIds.length === 0) {
            return tables as Table[];
        }

        // Get all open orders (including for FREE tables with orders but no items yet)
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select(`
                id,
                order_number,
                total_amount,
                table_id,
                order_items(id)
            `)
            .in('table_id', allTableIds)
            .eq('status', 'open');

        if (ordersError) throw ordersError;

        // Map orders to tables
        const tablesWithOrders = (tables as Table[]).map(table => {
            const tableOrder = orders?.find(o => o.table_id === table.id);
            if (tableOrder) {
                return {
                    ...table,
                    current_order: {
                        id: tableOrder.id,
                        order_number: tableOrder.order_number,
                        total_amount: tableOrder.total_amount,
                        items_count: tableOrder.order_items?.length || 0,
                    }
                };
            }
            return table;
        });

        return tablesWithOrders;
    },

    /**
     * Get table by ID
     */
    async getById(id: string): Promise<Table> {
        const { data, error } = await supabase
            .from('tables')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as Table;
    },

    /**
     * Create a new table
     */
    async create(tableData: CreateTableInput): Promise<Table> {
        const { data, error } = await supabase
            .from('tables')
            .insert({
                ...tableData,
                status: 'FREE',
                is_active: true,
                position_x: tableData.position_x ?? 0,
                position_y: tableData.position_y ?? 0,
                width: tableData.width ?? 1,
                height: tableData.height ?? 1,
                rotation: tableData.rotation ?? 0,
                shape: tableData.shape ?? 'rectangle',
            })
            .select()
            .single();

        if (error) throw error;
        return data as Table;
    },

    /**
     * Update a table
     */
    async update(id: string, tableData: UpdateTableInput): Promise<Table> {
        const { data, error } = await supabase
            .from('tables')
            .update(tableData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Table;
    },

    /**
     * Update table status
     */
    async updateStatus(id: string, status: TableStatus): Promise<Table> {
        const { data, error } = await supabase
            .from('tables')
            .update({ status })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Table;
    },

    /**
     * Delete a table (soft delete - sets is_active to false)
     */
    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('tables')
            .update({ is_active: false })
            .eq('id', id);

        if (error) throw error;
    },

    /**
     * Hard delete a table
     */
    async hardDelete(id: string): Promise<void> {
        const { error } = await supabase
            .from('tables')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    /**
     * Open a table (set to OCCUPIED and create an order)
     * Returns the created order ID
     */
    /**
     * Open a table (select waiter and prepare for service)
     * Does NOT create order - order is created when first item is added
     * Returns tableId
     */
    async openTable(tableId: string): Promise<string> {
        // Verify table exists
        const { data: table, error: tableError } = await supabase
            .from('tables')
            .select('*')
            .eq('id', tableId)
            .single();

        if (tableError || !table) {
            throw new Error('Mesa no encontrada');
        }

        // Just return tableId - order will be created when first item is added
        return tableId;
    },

    /**
     * Create order for a table (called when first item is added)
     * If order already exists, returns existing orderId
     */
    async createOrderForTable(tableId: string, waiterId?: string, customerId?: string): Promise<string> {
        // Check if order already exists
        const { data: existingOrder } = await supabase
            .from('orders')
            .select('id')
            .eq('table_id', tableId)
            .eq('status', 'open')
            .single();

        if (existingOrder) {
            return existingOrder.id;
        }

        // Generate autoincremental order number
        const { count } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true });

        const orderNumber = ((count || 0) + 1).toString();

        // Create the order with 'open' status
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                order_number: orderNumber,
                table_id: tableId,
                waiter_id: waiterId || null,
                customer_id: customerId || null,
                status: 'open',
                subtotal: 0,
                tax_amount: 0,
                total_amount: 0,
                order_date: new Date().toISOString(),
            })
            .select()
            .single();

        if (orderError) {
            throw orderError;
        }

        // Mark table as OCCUPIED now that order exists
        await this.updateStatus(tableId, 'OCCUPIED');

        return order.id;
    },

    /**
     * Close a table (set to FREE after order completion)
     */
    async closeTable(tableId: string): Promise<void> {
        // Update any open orders for this table to completed
        const { error: orderError } = await supabase
            .from('orders')
            .update({ status: 'completed' })
            .eq('table_id', tableId)
            .eq('status', 'open');

        if (orderError) throw orderError;

        // Update table status to FREE
        await this.updateStatus(tableId, 'FREE');
    },

    /**
     * Set table to waiting for payment (after printing ticket)
     * If table is FREE, changes to WAITING_PAYMENT (handles case where no items were added yet)
     */
    async setWaitingPayment(tableId: string): Promise<void> {
        await this.updateStatus(tableId, 'WAITING_PAYMENT');
    },

    /**
     * Process payment for a table
     * If auto_invoice is true, creates invoice automatically
     * Returns the order ID
     */
    async processPayment(
        tableId: string,
        payments: { payment_method_id: string; amount: number }[],
        autoInvoice: boolean
    ): Promise<string> {
        // Get the active order
        const order = await this.getActiveOrder(tableId);
        if (!order) {
            throw new Error('No active order found for this table');
        }

        // For backward compatibility, use first payment method
        const legacyPaymentMethodId = payments[0]?.payment_method_id || null;

        // Update order with payment method (legacy field)
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                payment_method_id: legacyPaymentMethodId,
                status: 'completed'
            })
            .eq('id', order.id);

        if (updateError) throw updateError;

        // Insert all payments into order_payments table
        if (payments.length > 0) {
            const paymentsToInsert = payments.map(p => ({
                order_id: order.id,
                payment_method_id: p.payment_method_id,
                amount: p.amount,
            }));

            const { error: paymentsError } = await supabase
                .from('order_payments')
                .insert(paymentsToInsert);

            if (paymentsError) throw paymentsError;
        }

        // Process stock deduction for completed order
        await orderService.processStockDeduction(order.id);

        // If auto_invoice, create fiscal document automatically
        if (autoInvoice) {
            try {
                // Get customer_id from order, or find ANONIMO customer
                let customerId = order.customer_id;

                if (!customerId) {
                    // Find ANONIMO customer
                    const { data: anonymousCustomer } = await supabase
                        .from('customers')
                        .select('id')
                        .or('business_name.ilike.%anonimo%,business_name.ilike.%anónimo%')
                        .limit(1)
                        .single();

                    if (anonymousCustomer) {
                        customerId = anonymousCustomer.id;
                    } else {
                        throw new Error('No se encontró cliente para la factura. Debe existir un cliente ANONIMO o asignar un cliente a la orden.');
                    }
                }

                await fiscalDocumentService.create({
                    customer_id: customerId,
                    order_id: order.id,
                    fdoc_number: `FDOC-${Date.now()}`,
                    fdoc_date: new Date().toISOString(),
                    total_amount: order.total_amount,
                    status: 'pending'
                });
            } catch (fiscalError) {
                console.error('Error creating automatic fiscal document:', fiscalError);
            }
        }

        // Set table to FREE
        await this.updateStatus(tableId, 'FREE');

        return order.id;
    },

    /**
     * Get the active order for a table
     */
    async getActiveOrder(tableId: string): Promise<any | null> {
        const { data, error } = await supabase
            .from('orders')
            .select('*, items:order_items(*, product:products(*))')
            .eq('table_id', tableId)
            .eq('status', 'open')
            .maybeSingle();

        if (error) throw error;
        return data;
    },

    /**
     * Bulk create tables
     */
    async bulkCreate(tables: CreateTableInput[]): Promise<Table[]> {
        const tablesToInsert = tables.map(t => ({
            ...t,
            status: 'FREE',
            is_active: true,
            position_x: t.position_x ?? 0,
            position_y: t.position_y ?? 0,
            width: t.width ?? 1,
            height: t.height ?? 1,
            rotation: t.rotation ?? 0,
            shape: t.shape ?? 'rectangle',
        }));

        const { data, error } = await supabase
            .from('tables')
            .insert(tablesToInsert)
            .select();

        if (error) throw error;
        return data as Table[];
    },
};
