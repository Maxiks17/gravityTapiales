import { useState, useEffect, useCallback } from 'react';
import { useTenant } from '../context/TenantContext';
import { tenantService } from '../services/tenantService';
import type { OperationMode } from '../types/operationMode';
import { OperationModeDefaults } from '../types/operationMode';

interface UseOperationModeResult {
    operationMode: OperationMode;
    loading: boolean;
    showTables: boolean;
    requiresDeliveryConfirmation: boolean;
    customerRequired: boolean;
    refresh: () => Promise<void>;
}

/**
 * Hook to get the current operation mode from tenant settings
 * Returns KIOSCO as default if not set
 * Caches the result to prevent layout shifts
 */
export function useOperationMode(): UseOperationModeResult {
    const { currentTenant } = useTenant();
    
    // Initialize from cache if available
    const getCachedMode = (): OperationMode => {
        if (!currentTenant) return 'KIOSCO';
        const cached = sessionStorage.getItem(`operation_mode_${currentTenant.id}`);
        return (cached as OperationMode) || 'KIOSCO';
    };
    
    const [operationMode, setOperationMode] = useState<OperationMode>(getCachedMode());
    const [loading, setLoading] = useState(false);

    const loadOperationMode = useCallback(async () => {
        if (!currentTenant) {
            setOperationMode('KIOSCO');
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const settings = await tenantService.getSettings(currentTenant.id);
            const mode = (settings.operation_mode as OperationMode) || 'KIOSCO';
            setOperationMode(mode);
            // Cache the result
            sessionStorage.setItem(`operation_mode_${currentTenant.id}`, mode);
        } catch (error) {
            console.error('Error loading operation mode:', error);
            setOperationMode('KIOSCO');
        } finally {
            setLoading(false);
        }
    }, [currentTenant]);

    useEffect(() => {
        loadOperationMode();
    }, [loadOperationMode]);

    const modeConfig = OperationModeDefaults[operationMode];

    return {
        operationMode,
        loading,
        showTables: modeConfig.showTables,
        requiresDeliveryConfirmation: modeConfig.requiresDeliveryConfirmation,
        customerRequired: modeConfig.customerRequired,
        refresh: loadOperationMode,
    };
}
