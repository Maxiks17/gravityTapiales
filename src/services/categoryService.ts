import { supabase } from './supabaseClient';
import type { PaginationResponse } from '../hooks/useServerPagination';

export interface Category {
    id: string;
    name: string;
    description?: string;
    image_url?: string;
    is_active: boolean;
    print_separately: boolean;
    created_at?: string;
    updated_at?: string;
}

export const categoryService = {
    async getAll() {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('name');

        if (error) throw error;
        return data as Category[];
    },

    async getPaginated(page: number = 1, pageSize: number = 10): Promise<PaginationResponse<Category>> {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const { count } = await supabase
            .from('categories')
            .select('*', { count: 'exact', head: true });

        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('name')
            .range(from, to);

        if (error) throw error;

        return {
            data: data as Category[],
            total: count || 0,
            page,
            pageSize,
            totalPages: Math.ceil((count || 0) / pageSize),
        };
    },

    async getById(id: string) {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as Category;
    },

    async create(category: Omit<Category, 'id' | 'created_at' | 'updated_at'>) {
        const { data, error } = await supabase
            .from('categories')
            .insert(category)
            .select()
            .single();

        if (error) throw error;
        return data as Category;
    },

    async update(id: string, category: Partial<Category>) {
        const { data, error } = await supabase
            .from('categories')
            .update(category)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Category;
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
