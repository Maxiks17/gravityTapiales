import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { productService, type Product } from '../services/productService';
import { categoryService, type Category } from '../services/categoryService';
import { customerService, type Customer } from '../services/customerService';
import { supabase } from '../services/supabaseClient';

interface POSDataContextType {
    products: Product[];
    categories: Category[];
    customers: Customer[];
    loading: boolean;
    loadData: () => Promise<void>;
    refreshData: () => Promise<void>;
    /** Silently refresh only stock quantities without full reload or loading state */
    refreshStock: () => Promise<void>;
}

const POSDataContext = createContext<POSDataContextType | undefined>(undefined);

export const POSDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(false);
    const hasLoadedData = useRef(false);

    const loadData = useCallback(async () => {
        // Si ya se cargaron los datos, no hacer nada
        if (hasLoadedData.current) {
            return;
        }

        try {
            setLoading(true);
            const [productsData, categoriesData, customersData] = await Promise.all([
                productService.getAllWithRealStock(),
                categoryService.getAll(),
                customerService.getAll(),
            ]);
            setProducts(productsData.filter(p => p.is_active));
            setCategories(categoriesData);
            setCustomers(customersData);
            hasLoadedData.current = true;
        } catch (error) {
            console.error('Error loading POS data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Escuchar cambios en la autenticación para limpiar datos
    React.useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT') {
                setProducts([]);
                setCategories([]);
                setCustomers([]);
                hasLoadedData.current = false;
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // Función para forzar la recarga de datos (útil después de crear/editar productos)
    const refreshData = useCallback(async () => {
        hasLoadedData.current = false;
        await loadData();
    }, [loadData]);

    // Refresh only stock quantities silently (no loading state, no flash)
    const refreshStock = useCallback(async () => {
        try {
            const updatedProducts = await productService.getAllWithRealStock();
            setProducts(updatedProducts.filter(p => p.is_active));
        } catch (error) {
            console.error('Error refreshing stock:', error);
        }
    }, []);

    const value = {
        products,
        categories,
        customers,
        loading,
        loadData,
        refreshData,
        refreshStock,
    };

    return <POSDataContext.Provider value={value}>{children}</POSDataContext.Provider>;
};

export const usePOSData = () => {
    const context = useContext(POSDataContext);
    if (context === undefined) {
        throw new Error('usePOSData must be used within a POSDataProvider');
    }
    return context;
};
