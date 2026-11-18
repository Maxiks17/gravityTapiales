import { supabase } from './supabaseClient';
import type { PaginationResponse } from '../hooks/useServerPagination';
import { UNIT_TYPES } from '../constants/unitTypes';

export interface Stock {
    id: string;
    name: string;
    description?: string;
    quantity: number;
    min_stock_level: number;
    unit_type_code?: string;
    unit_type?: { code: string; name: string; allows_decimals: boolean };
    cost_price: number;
    is_active: boolean;
    tenant_id?: string;
    created_at?: string;
    updated_at?: string;
    linked_product?: { id: string; name: string } | null;
}

export interface CreateStockInput {
    name: string;
    description?: string;
    quantity?: number;
    min_stock_level?: number;
    unit_type_code?: string;
    cost_price?: number;
}

export const stockService = {
    async getAll() {
        const { data: stocks, error } = await supabase
            .from('stocks')
            .select('*')
            .eq('is_active', true)
            .order('name');

        if (error) throw error;

        // Get linked products
        const stockIds = stocks.map(s => s.id);
        const { data: products } = await supabase
            .from('products')
            .select('id, name, linked_stock_id')
            .in('linked_stock_id', stockIds);

        const productMap = new Map(products?.map(p => [p.linked_stock_id, { id: p.id, name: p.name }]) || []);

        return stocks.map(s => ({
            ...s,
            unit_type: UNIT_TYPES[s.unit_type_code ?? ''] ?? undefined,
            linked_product: productMap.get(s.id) || null,
        })) as Stock[];
    },

    async getPaginated(
        page: number = 1,
        pageSize: number = 20,
        searchTerm: string = ''
    ): Promise<PaginationResponse<Stock>> {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let countQuery = supabase
            .from('stocks')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        let dataQuery = supabase
            .from('stocks')
            .select('*')
            .eq('is_active', true);

        if (searchTerm) {
            countQuery = countQuery.ilike('name', `%${searchTerm}%`);
            dataQuery = dataQuery.ilike('name', `%${searchTerm}%`);
        }

        const { count } = await countQuery;
        const { data: stocks, error } = await dataQuery
            .order('name')
            .range(from, to);

        if (error) throw error;

        // Get linked products for this page
        const stockIds = stocks.map(s => s.id);
        const { data: products } = await supabase
            .from('products')
            .select('id, name, linked_stock_id')
            .in('linked_stock_id', stockIds);

        const productMap = new Map(products?.map(p => [p.linked_stock_id, { id: p.id, name: p.name }]) || []);

        const stocksWithProducts = stocks.map(s => ({
            ...s,
            unit_type: UNIT_TYPES[s.unit_type_code ?? ''] ?? undefined,
            linked_product: productMap.get(s.id) || null,
        }));

        return {
            data: stocksWithProducts as Stock[],
            total: count || 0,
            page,
            pageSize,
            totalPages: Math.ceil((count || 0) / pageSize),
        };
    },

    async getLowStock(): Promise<Stock[]> {
        const { data, error } = await supabase
            .from('stocks')
            .select('*')
            .eq('is_active', true)
            .order('name');

        if (error) throw error;

        return (data as any[])
            .map(s => ({ ...s, unit_type: UNIT_TYPES[s.unit_type_code ?? ''] ?? undefined }))
            .filter((s: Stock) => s.quantity <= s.min_stock_level);
    },

    async getById(id: string) {
        const { data, error } = await supabase
            .from('stocks')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return { ...data, unit_type: UNIT_TYPES[data.unit_type_code ?? ''] ?? undefined } as Stock;
    },

    async create(stock: CreateStockInput) {
        const { data, error } = await supabase
            .from('stocks')
            .insert({
                name: stock.name,
                description: stock.description || null,
                quantity: stock.quantity ?? 0,
                min_stock_level: stock.min_stock_level ?? 0,
                unit_type_code: stock.unit_type_code || null,
                cost_price: stock.cost_price ?? 0,
                is_active: true,
            })
            .select('*')
            .single();

        if (error) throw error;
        return {
            ...data,
            unit_type: UNIT_TYPES[data.unit_type_code ?? ''] ?? undefined,
            linked_product: null,
        } as Stock;
    },

    async update(id: string, stock: Partial<Stock>) {
        const { unit_type, tenant_id, created_at, updated_at, linked_product, ...cleanStock } = stock as any;

        const { data, error } = await supabase
            .from('stocks')
            .update(cleanStock)
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw error;

        // Get linked product if exists
        const { data: product } = await supabase
            .from('products')
            .select('id, name')
            .eq('linked_stock_id', id)
            .maybeSingle();

        return {
            ...data,
            unit_type: UNIT_TYPES[data.unit_type_code ?? ''] ?? undefined,
            linked_product: product || null,
        } as Stock;
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('stocks')
            .update({ is_active: false })
            .eq('id', id);

        if (error) throw error;
    },

    async adjustStock(stockId: string, newQuantity: number, reason: string) {
        const { data: user } = await supabase.auth.getUser();

        const { data, error } = await supabase.rpc('adjust_stock', {
            p_stock_id: stockId,
            p_new_quantity: newQuantity,
            p_reason: reason,
            p_user_id: user.user?.id || null,
        });

        if (error) throw error;
        return data;
    },

    async search(query: string): Promise<Stock[]> {
        const { data, error } = await supabase
            .from('stocks')
            .select('*')
            .eq('is_active', true)
            .ilike('name', `%${query}%`)
            .order('name')
            .limit(20);

        if (error) throw error;
        return (data as any[]).map(s => ({ ...s, unit_type: UNIT_TYPES[s.unit_type_code ?? ''] ?? undefined }));
    },

    async getLinkedProducts(stockId: string): Promise<{ id: string; name: string }[]> {
        // Check if stock is used in any product composition
        const { data, error } = await supabase
            .from('product_composition')
            .select('product:products(id, name)')
            .eq('stock_id', stockId);

        if (error) throw error;

        return (data || [])
            .map(d => (d as any).product)
            .filter((p): p is { id: string; name: string } => p !== null && p !== undefined);
    },

    async canDelete(stockId: string): Promise<{
        canDelete: boolean;
        reason?: string;
        linkedProducts?: string[];
        linkedSimpleProduct?: { id: string; name: string } | null;
    }> {
        // Check if used in composite products
        const linkedProducts = await this.getLinkedProducts(stockId);

        if (linkedProducts.length > 0) {
            return {
                canDelete: false,
                reason: 'No se puede eliminar este ítem porque está vinculado a uno o más productos compuestos. Desvincúlelo antes de continuar.',
                linkedProducts: linkedProducts.map(p => p.name),
            };
        }

        // Check if linked to a simple product
        const { data: simpleProduct } = await supabase
            .from('products')
            .select('id, name')
            .eq('linked_stock_id', stockId)
            .maybeSingle();

        return {
            canDelete: true,
            linkedSimpleProduct: simpleProduct || null,
        };
    },

    async deleteWithProduct(stockId: string): Promise<void> {
        // First deactivate any linked simple product (soft delete)
        const { data: linkedProduct } = await supabase
            .from('products')
            .select('id')
            .eq('linked_stock_id', stockId)
            .maybeSingle();

        if (linkedProduct) {
            const { error: productError } = await supabase
                .from('products')
                .update({ is_active: false })
                .eq('id', linkedProduct.id);

            if (productError) throw productError;
        }

        // Then deactivate the stock (soft delete)
        const { error } = await supabase
            .from('stocks')
            .update({ is_active: false })
            .eq('id', stockId);

        if (error) throw error;
    },
};
