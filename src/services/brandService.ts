import { supabase } from './supabaseClient';
import type { PaginationResponse } from '../hooks/useServerPagination';

export interface Brand {
    id: string;
    name: string;
    description?: string;
    logo_url?: string;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}

export const brandService = {
    async getAll() {
        const { data, error } = await supabase
            .from('brands')
            .select('*')
            .order('name');

        if (error) throw error;
        return data as Brand[];
    },

    async getPaginated(page: number = 1, pageSize: number = 10): Promise<PaginationResponse<Brand>> {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const { count } = await supabase
            .from('brands')
            .select('*', { count: 'exact', head: true });

        const { data, error } = await supabase
            .from('brands')
            .select('*')
            .order('name')
            .range(from, to);

        if (error) throw error;

        return {
            data: data as Brand[],
            total: count || 0,
            page,
            pageSize,
            totalPages: Math.ceil((count || 0) / pageSize),
        };
    },

    async getById(id: string) {
        const { data, error } = await supabase
            .from('brands')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as Brand;
    },

    async create(brand: Omit<Brand, 'id' | 'created_at' | 'updated_at'>) {
        const { data, error } = await supabase
            .from('brands')
            .insert(brand)
            .select()
            .single();

        if (error) throw error;
        return data as Brand;
    },

    async update(id: string, brand: Partial<Brand>) {
        const { data, error } = await supabase
            .from('brands')
            .update(brand)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Brand;
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('brands')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
