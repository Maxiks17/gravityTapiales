import { useState, useEffect, useRef } from 'react';
import { tenantService } from '../services/tenantService';
import { useTenant } from '../context/TenantContext';

export const useStockControl = () => {
    const [controlStock, setControlStock] = useState(true); // Default to true for safety
    const [loading, setLoading] = useState(true);
    const { currentTenant } = useTenant();
    const hasLoadedSetting = useRef(false);

    useEffect(() => {
        const loadStockControlSetting = async () => {
            if (!currentTenant) return;

            try {
                const settings = await tenantService.getSettings(currentTenant.id);
                // Check if setting exists, otherwise default to true
                if (settings.control_stock !== undefined) {
                    setControlStock(settings.control_stock === 'true' || settings.control_stock === true);
                }
            } catch (error) {
                console.error('Error loading stock control setting:', error);
                // Keep default value (true) on error for safety
            } finally {
                setLoading(false);
            }
        };

        if (currentTenant && !hasLoadedSetting.current) {
            loadStockControlSetting();
            hasLoadedSetting.current = true;
        } else if (!currentTenant) {
            setLoading(false);
        }
    }, [currentTenant]);

    return { controlStock, loading };
};