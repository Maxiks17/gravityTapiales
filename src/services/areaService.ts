import { supabase } from './supabaseClient';
import type { Area, CreateAreaInput, UpdateAreaInput } from '../types/operationMode';

export const areaService = {
    /**
     * Get all areas for the current tenant
     */
    async getAll(): Promise<Area[]> {
        const { data, error } = await supabase
            .from('areas')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) throw error;
        return data as Area[];
    },

    /**
     * Get area by ID
     */
    async getById(id: string): Promise<Area> {
        const { data, error } = await supabase
            .from('areas')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as Area;
    },

    /**
     * Create a new area
     */
    async create(areaData: CreateAreaInput): Promise<Area> {
        // Get the current max sort order to append to the end
        const { data: maxOrderData } = await supabase
            .from('areas')
            .select('sort_order')
            .order('sort_order', { ascending: false })
            .limit(1)
            .maybeSingle();

        const nextOrder = (maxOrderData?.sort_order ?? 0) + 1;

        const { data, error } = await supabase
            .from('areas')
            .insert({
                ...areaData,
                sort_order: areaData.sort_order ?? nextOrder,
                is_active: true,
            })
            .select()
            .single();

        if (error) throw error;
        return data as Area;
    },

    /**
     * Update an area
     */
    async update(id: string, areaData: UpdateAreaInput): Promise<Area> {
        const { data, error } = await supabase
            .from('areas')
            .update(areaData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Area;
    },

    /**
     * Delete an area (soft delete)
     */
    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('areas')
            .update({ is_active: false })
            .eq('id', id);

        if (error) throw error;
    },

    /**
     * Hard delete an area
     */
    async hardDelete(id: string): Promise<void> {
        const { error } = await supabase
            .from('areas')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
