import { supabase } from './supabaseClient';

export interface TaxRateType {
    id: number;
    nombre: string;
}

export const taxRateTypeService = {
    async getAll() {
        const { data, error } = await supabase
            .from('tax_rate_types')
            .select('id, nombre')
            .order('id');

        if (error) throw error;
        return (data || []) as TaxRateType[];
    }
};
