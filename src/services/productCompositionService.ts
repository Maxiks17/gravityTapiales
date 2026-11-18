import { supabase } from './supabaseClient';
import { UNIT_TYPES } from '../constants/unitTypes';

export interface ProductComposition {
    id: string;
    product_id: string;
    stock_id: string;
    stock?: {
        id: string;
        name: string;
        quantity: number;
        min_stock_level: number;
        unit_type_code?: string;
        unit_type?: { code: string; name: string };
    };
    factor: number;
    tenant_id?: string;
    created_at?: string;
    updated_at?: string;
}

function resolveCompositionUnitTypes(items: any[]): ProductComposition[] {
    return items.map(item => ({
        ...item,
        stock: item.stock
            ? { ...item.stock, unit_type: UNIT_TYPES[item.stock.unit_type_code ?? ''] ?? undefined }
            : undefined,
    }));
}

export interface CompositionInput {
    stock_id: string;
    factor: number;
}

export const productCompositionService = {
    async getByProduct(productId: string): Promise<ProductComposition[]> {
        const { data, error } = await supabase
            .from('product_composition')
            .select(`
                *,
                stock:stocks(
                    id,
                    name,
                    quantity,
                    min_stock_level,
                    unit_type_code
                )
            `)
            .eq('product_id', productId)
            .order('created_at');

        if (error) throw error;
        return resolveCompositionUnitTypes(data);
    },

    async setComposition(productId: string, compositions: CompositionInput[]): Promise<void> {
        const { error: deleteError } = await supabase
            .from('product_composition')
            .delete()
            .eq('product_id', productId);

        if (deleteError) throw deleteError;

        if (compositions.length > 0) {
            const { error: insertError } = await supabase
                .from('product_composition')
                .insert(
                    compositions.map(c => ({
                        product_id: productId,
                        stock_id: c.stock_id,
                        factor: c.factor,
                    }))
                );

            if (insertError) throw insertError;

            await supabase
                .from('products')
                .update({ product_type: 'composite', linked_stock_id: null })
                .eq('id', productId);
        } else {
            await supabase
                .from('products')
                .update({ product_type: 'simple' })
                .eq('id', productId);
        }
    },

    async addComponent(
        productId: string,
        stockId: string,
        factor: number
    ): Promise<ProductComposition> {
        const { data, error } = await supabase
            .from('product_composition')
            .insert({
                product_id: productId,
                stock_id: stockId,
                factor: factor,
            })
            .select(`
                *,
                stock:stocks(
                    id,
                    name,
                    quantity,
                    min_stock_level,
                    unit_type_code
                )
            `)
            .single();

        if (error) throw error;
        return resolveCompositionUnitTypes([data])[0];
    },

    async updateFactor(compositionId: string, factor: number): Promise<ProductComposition> {
        const { data, error } = await supabase
            .from('product_composition')
            .update({ factor })
            .eq('id', compositionId)
            .select(`
                *,
                stock:stocks(
                    id,
                    name,
                    quantity,
                    min_stock_level,
                    unit_type_code
                )
            `)
            .single();

        if (error) throw error;
        return resolveCompositionUnitTypes([data])[0];
    },

    async removeComponent(compositionId: string): Promise<void> {
        const { error } = await supabase
            .from('product_composition')
            .delete()
            .eq('id', compositionId);

        if (error) throw error;
    },

    async checkAvailability(
        productId: string,
        quantity: number
    ): Promise<{ available: boolean; missing: { stockName: string; needed: number; available: number }[] }> {
        const compositions = await this.getByProduct(productId);

        const missing: { stockName: string; needed: number; available: number }[] = [];

        for (const comp of compositions) {
            const needed = quantity * comp.factor;
            const available = comp.stock?.quantity || 0;

            if (needed > available) {
                missing.push({
                    stockName: comp.stock?.name || 'Unknown',
                    needed,
                    available,
                });
            }
        }

        return {
            available: missing.length === 0,
            missing,
        };
    },
};
