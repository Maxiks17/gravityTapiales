import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { Tenant } from '../types/tenant';
import { tenantService } from '../services/tenantService';
import { useAuth } from './AuthContext';

interface TenantContextType {
    currentTenant: Tenant | null;
    availableTenants: Tenant[];
    loading: boolean;
    isFirstLogin: boolean;
    switchTenant: (tenantId: string) => Promise<void>;
    refreshTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
    const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFirstLogin, setIsFirstLogin] = useState(false);
    const hasLoadedTenants = useRef(false);
    const lastUserId = useRef<string | null>(null);

    // Load tenant information when user changes
    useEffect(() => {
        if (user) {
            // Solo cargar si el usuario cambió o si nunca se ha cargado
            if (!hasLoadedTenants.current || lastUserId.current !== user.id) {
                loadTenants();
                lastUserId.current = user.id;
                hasLoadedTenants.current = true;
            }
        } else {
            setCurrentTenant(null);
            setAvailableTenants([]);
            setLoading(false);
            hasLoadedTenants.current = false;
            lastUserId.current = null;
        }
    }, [user]);

    const loadTenants = async () => {
        try {
            setLoading(true);

            // Get all tenants the user belongs to
            const userTenants = await tenantService.getUserTenants();
            const tenants = userTenants.map(ut => ut.tenant).filter(Boolean) as Tenant[];
            setAvailableTenants(tenants);

            // Check if we have a saved tenant preference in localStorage
            const savedTenantId = localStorage.getItem('currentTenantId');
            let tenant: Tenant | null = null;

            if (savedTenantId) {
                // Try to use the saved tenant if the user still has access to it
                tenant = tenants.find(t => t.id === savedTenantId) || null;
            }

            // If no saved preference or user doesn't have access, use the first tenant
            if (!tenant && tenants.length > 0) {
                tenant = tenants[0];
            }

            setCurrentTenant(tenant);

            // Save the current tenant to localStorage
            if (tenant) {
                localStorage.setItem('currentTenantId', tenant.id);

                // Check if this is a first login (tenant setup not complete)
                const setupComplete = tenant.settings?.is_setup_complete ?? true;
                setIsFirstLogin(!setupComplete);
            }
        } catch (error) {
            console.error('Error loading tenants:', error);
        } finally {
            setLoading(false);
        }
    };

    const switchTenant = async (tenantId: string) => {
        const tenant = availableTenants.find(t => t.id === tenantId);
        if (tenant) {
            setCurrentTenant(tenant);
            localStorage.setItem('currentTenantId', tenant.id);

            // Reload the page to refresh all data with the new tenant context
            window.location.reload();
        }
    };

    const refreshTenant = async () => {
        await loadTenants();
    };

    const value = {
        currentTenant,
        availableTenants,
        loading,
        isFirstLogin,
        switchTenant,
        refreshTenant,
    };

    return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

export const useTenant = () => {
    const context = useContext(TenantContext);
    if (context === undefined) {
        throw new Error('useTenant must be used within a TenantProvider');
    }
    return context;
};
