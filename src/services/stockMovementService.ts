import { supabase } from './supabaseClient';
import type { PaginationResponse } from '../hooks/useServerPagination';

export type StockMovementType =
    | 'sale'
    | 'purchase'
    | 'adjustment'
    | 'transfer'
    | 'return'
    | 'waste'
    | 'initial';

export interface StockMovement {
    id: string;
    stock_id: string;
    stock?: { name: string };
    movement_type: StockMovementType;
    quantity: number;
    quantity_before: number;
    quantity_after: number;
    reason?: string;
    reference_id?: string;
    reference_type?: string;
    user_id?: string;
    tenant_id?: string;
    created_at: string;
}

const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
    sale: 'Venta',
    purchase: 'Compra',
    adjustment: 'Ajuste',
    transfer: 'Transferencia',
    return: 'Devolución',
    waste: 'Merma',
    initial: 'Inicial',
};

export const stockMovementService = {
    getMovementTypeLabel(type: StockMovementType): string {
        return MOVEMENT_TYPE_LABELS[type] || type;
    },

    async getByStock(
        stockId: string,
        page: number = 1,
        pageSize: number = 20
    ): Promise<PaginationResponse<StockMovement>> {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const { count } = await supabase
            .from('stock_movements')
            .select('*', { count: 'exact', head: true })
            .eq('stock_id', stockId);

        const { data, error } = await supabase
            .from('stock_movements')
            .select('*, stock:stocks(name)')
            .eq('stock_id', stockId)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        return {
            data: data as StockMovement[],
            total: count || 0,
            page,
            pageSize,
            totalPages: Math.ceil((count || 0) / pageSize),
        };
    },

    async getRecent(limit: number = 50): Promise<StockMovement[]> {
        const { data, error } = await supabase
            .from('stock_movements')
            .select('*, stock:stocks(name)')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data as StockMovement[];
    },

    async getByOrder(orderId: string): Promise<StockMovement[]> {
        const { data, error } = await supabase
            .from('stock_movements')
            .select('*, stock:stocks(name)')
            .eq('reference_id', orderId)
            .eq('reference_type', 'order')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as StockMovement[];
    },

    async getByDateRange(
        startDate: string,
        endDate: string,
        page: number = 1,
        pageSize: number = 50
    ): Promise<PaginationResponse<StockMovement>> {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const { count } = await supabase
            .from('stock_movements')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startDate)
            .lte('created_at', endDate);

        const { data, error } = await supabase
            .from('stock_movements')
            .select('*, stock:stocks(name)')
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        return {
            data: data as StockMovement[],
            total: count || 0,
            page,
            pageSize,
            totalPages: Math.ceil((count || 0) / pageSize),
        };
    },
};
