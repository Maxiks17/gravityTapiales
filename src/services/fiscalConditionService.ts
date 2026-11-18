import { supabase } from './supabaseClient';

export interface FiscalCondition {
    id: number;
    name: string;
    id_afip: number | null;
}

export const fiscalConditionService = {
    async getAll() {
        const { data, error } = await supabase
            .from('fiscal_condition')
            .select('id, name, id_afip')
            .order('name');

        if (error) throw error;
        return (data || []) as FiscalCondition[];
    }
};
