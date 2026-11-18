import { supabase } from './supabaseClient';
import type { Tenant, UserTenant } from '../types/tenant';

export const tenantService = {
    /**
     * Get all tenants (admin only)
     */
    async getAll(): Promise<Tenant[]> {
        const { data, error } = await supabase
            .from('tenants')
            .select('*')
            .order('name');

        if (error) throw error;
        return data as Tenant[];
    },

    /**
     * Get tenant by ID
     */
    async getById(id: string): Promise<Tenant> {
        const { data, error } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as Tenant;
    },

    /**
     * Get tenant by slug
     */
    async getBySlug(slug: string): Promise<Tenant> {
        const { data, error } = await supabase
            .from('tenants')
            .select('*')
            .eq('slug', slug)
            .single();

        if (error) throw error;
        return data as Tenant;
    },

    /**
     * Get current user's tenants
     */
    async getUserTenants(): Promise<UserTenant[]> {
        const { data, error } = await supabase
            .from('user_tenants')
            .select('*, tenant:tenants(*)')
            .eq('is_active', true)
            .order('created_at');

        if (error) throw error;
        return data as UserTenant[];
    },

    /**
     * Get current user's primary tenant (first active one)
     */
    async getUserPrimaryTenant(): Promise<Tenant | null> {
        const { data, error } = await supabase
            .from('user_tenants')
            .select('*, tenant:tenants(*)')
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        if (!data) return null;

        return (data as UserTenant).tenant || null;
    },

    /**
     * Create a new tenant
     */
    async create(tenant: Omit<Tenant, 'id' | 'created_at' | 'updated_at'>): Promise<Tenant> {
        const { data, error } = await supabase
            .from('tenants')
            .insert(tenant)
            .select()
            .single();

        if (error) throw error;
        return data as Tenant;
    },

    /**
     * Update tenant
     */
    async update(id: string, tenant: Partial<Tenant>): Promise<Tenant> {
        const { data, error } = await supabase
            .from('tenants')
            .update(tenant)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Tenant;
    },

    /**
     * Add user to tenant
     */
    async addUserToTenant(
        userId: string,
        tenantId: string,
        role: UserTenant['role'] = 'user'
    ): Promise<UserTenant> {
        const { data, error } = await supabase
            .from('user_tenants')
            .insert({
                user_id: userId,
                tenant_id: tenantId,
                role,
                is_active: true
            })
            .select()
            .single();

        if (error) throw error;
        return data as UserTenant;
    },

    /**
     * Remove user from tenant
     */
    async removeUserFromTenant(userId: string, tenantId: string): Promise<void> {
        const { error } = await supabase
            .from('user_tenants')
            .delete()
            .eq('user_id', userId)
            .eq('tenant_id', tenantId);

        if (error) throw error;
    },

    /**
     * Update user's role in tenant
     */
    async updateUserRole(userId: string, tenantId: string, role: UserTenant['role']): Promise<UserTenant> {
        const { data, error } = await supabase
            .from('user_tenants')
            .update({ role })
            .eq('user_id', userId)
            .eq('tenant_id', tenantId)
            .select()
            .single();

        if (error) throw error;
        return data as UserTenant;
    },

    /**
     * Complete initial setup for a tenant
     */
    async completeSetup(tenantId: string, tenantData: { name: string; email?: string; phone?: string; address?: string }): Promise<Tenant> {
        const settings = { is_setup_complete: true };

        // We need to fetch existing settings first to not overwrite them
        const existingTenant = await this.getById(tenantId);
        const newSettings = { ...existingTenant.settings, ...settings };

        const { data, error } = await supabase
            .from('tenants')
            .update({
                name: tenantData.name,
                email: tenantData.email,
                phone: tenantData.phone,
                address: tenantData.address,
                settings: newSettings
            })
            .eq('id', tenantId)
            .select()
            .single();

        if (error) throw error;
        return data as Tenant;
    },

    /**
     * Get tenant settings
     */
    async getSettings(tenantId: string): Promise<Record<string, any>> {
        const tenant = await this.getById(tenantId);
        return tenant.settings || {};
    },

    /**
     * Update all tenant settings (merge)
     */
    async updateSettings(tenantId: string, newSettings: Record<string, any>): Promise<Tenant> {
        const currentSettings = await this.getSettings(tenantId);
        const mergedSettings = { ...currentSettings, ...newSettings };

        const { data, error } = await supabase
            .from('tenants')
            .update({ settings: mergedSettings })
            .eq('id', tenantId)
            .select()
            .single();

        if (error) throw error;
        return data as Tenant;
    },

    /**
     * Update a single setting key
     */
    async updateSetting(tenantId: string, key: string, value: any): Promise<Tenant> {
        const currentSettings = await this.getSettings(tenantId);
        const mergedSettings = { ...currentSettings, [key]: value };

        const { data, error } = await supabase
            .from('tenants')
            .update({ settings: mergedSettings })
            .eq('id', tenantId)
            .select()
            .single();

        if (error) throw error;
        return data as Tenant;
    }
};
