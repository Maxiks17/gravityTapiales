// Tenant-related TypeScript interfaces

export interface Tenant {
    id: string;
    name: string;
    slug: string;
    email?: string;
    phone?: string;
    address?: string;
    subscription_status: 'active' | 'suspended' | 'cancelled';
    subscription_plan?: string;
    billing_email?: string;
    settings?: Record<string, any>;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface UserTenant {
    id: string;
    user_id: string;
    tenant_id: string;
    role: 'admin' | 'manager' | 'sales' | 'user';
    is_active: boolean;
    created_at?: string;
    tenant?: Tenant; // For joined queries
}
