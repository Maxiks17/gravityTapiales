import { supabase } from './supabaseClient';
import type { Staff, CreateStaffInput, UpdateStaffInput, StaffPosition } from '../types/operationMode';

export const staffService = {
    /**
     * Get all staff members for a tenant
     */
    async getAll(tenantId: string, position?: StaffPosition): Promise<Staff[]> {
        try {
            let query = supabase
                .from('staff')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('first_name', { ascending: true });

            if (position) {
                query = query.eq('position', position);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching staff:', error);
            throw error;
        }
    },

    /**
     * Get only active staff members
     */
    async getActive(tenantId: string, position?: StaffPosition): Promise<Staff[]> {
        try {
            let query = supabase
                .from('staff')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('is_active', true)
                .order('first_name', { ascending: true });

            if (position) {
                query = query.eq('position', position);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching active staff:', error);
            throw error;
        }
    },

    /**
     * Get staff member by ID
     */
    async getById(id: string): Promise<Staff | null> {
        try {
            const { data, error } = await supabase
                .from('staff')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching staff member:', error);
            throw error;
        }
    },

    /**
     * Create a new staff member
     */
    async create(tenantId: string, input: CreateStaffInput): Promise<Staff> {
        try {
            const { data, error } = await supabase
                .from('staff')
                .insert({
                    tenant_id: tenantId,
                    first_name: input.first_name,
                    last_name: input.last_name,
                    email: input.email,
                    phone: input.phone,
                    position: input.position,
                    hire_date: input.hire_date || new Date().toISOString().split('T')[0],
                    notes: input.notes,
                    is_active: true,
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error creating staff member:', error);
            throw error;
        }
    },

    /**
     * Update staff member
     */
    async update(id: string, input: UpdateStaffInput): Promise<Staff> {
        try {
            const { data, error } = await supabase
                .from('staff')
                .update(input)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error updating staff member:', error);
            throw error;
        }
    },

    /**
     * Soft delete (deactivate) staff member
     */
    async deactivate(id: string): Promise<void> {
        try {
            const { error } = await supabase
                .from('staff')
                .update({ is_active: false })
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            console.error('Error deactivating staff member:', error);
            throw error;
        }
    },

    /**
     * Reactivate staff member
     */
    async activate(id: string): Promise<void> {
        try {
            const { error } = await supabase
                .from('staff')
                .update({ is_active: true })
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            console.error('Error activating staff member:', error);
            throw error;
        }
    },

    /**
     * Permanently delete staff member
     */
    async delete(id: string): Promise<void> {
        try {
            const { error } = await supabase
                .from('staff')
                .delete()
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            console.error('Error deleting staff member:', error);
            throw error;
        }
    },

    /**
     * Get staff member full name
     */
    getFullName(staff: Staff | null): string {
        if (!staff) return 'Sin asignar';
        return staff.last_name ? `${staff.first_name} ${staff.last_name}` : staff.first_name;
    },

    /**
     * Get position label in Spanish
     */
    getPositionLabel(position: StaffPosition): string {
        const labels: Record<StaffPosition, string> = {
            waiter: 'Mozo',
            cashier: 'Cajero',
            cook: 'Cocinero',
            manager: 'Gerente',
            host: 'Recepcionista',
            bartender: 'Bartender',
            cleaner: 'Limpieza',
        };
        return labels[position] || position;
    },
};

export const STAFF_POSITIONS: Array<{ value: StaffPosition; label: string }> = [
    { value: 'waiter', label: 'Mozo' },
    { value: 'cashier', label: 'Cajero' },
    { value: 'cook', label: 'Cocinero' },
    { value: 'bartender', label: 'Bartender' },
    { value: 'host', label: 'Recepcionista' },
    { value: 'manager', label: 'Gerente' },
    { value: 'cleaner', label: 'Limpieza' },
];
