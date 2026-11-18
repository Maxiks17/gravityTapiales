import { supabase } from './supabaseClient';
import type { PaginationResponse } from '../hooks/useServerPagination';

export interface Customer {
    id: string;
    business_name: string;
    contact_name?: string;
    document_type?: number;
    document_number?: string | null;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    condicion_fiscal_id?: number | null;
    credit_limit?: number;
    payment_terms?: number;
    discount_percentage?: number;
    is_active: boolean;
    notes?: string;
    created_at?: string;
    updated_at?: string;
}

export const customerService = {
    async getAll() {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .order('business_name');

        if (error) throw error;
        return data as Customer[];
    },

    async getPaginated(page: number = 1, pageSize: number = 10, searchTerm: string = ''): Promise<PaginationResponse<Customer>> {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
            .from('customers')
            .select('*', { count: 'exact' });

        // Aplicar filtro de búsqueda si existe
        if (searchTerm) {
            query = query.or(`business_name.ilike.%${searchTerm}%,contact_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
        }

        const { count } = await query;

        query = supabase
            .from('customers')
            .select('*');

        if (searchTerm) {
            query = query.or(`business_name.ilike.%${searchTerm}%,contact_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
        }

        const { data, error } = await query
            .order('business_name')
            .range(from, to);

        if (error) throw error;

        return {
            data: data as Customer[],
            total: count || 0,
            page,
            pageSize,
            totalPages: Math.ceil((count || 0) / pageSize),
        };
    },

    async getById(id: string) {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as Customer;
    },

    async create(customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) {
        const { data, error } = await supabase
            .from('customers')
            .insert(customer)
            .select()
            .single();

        if (error) throw error;
        return data as Customer;
    },

    async update(id: string, customer: Partial<Customer>) {
        const { data, error } = await supabase
            .from('customers')
            .update(customer)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Customer;
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('customers')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
