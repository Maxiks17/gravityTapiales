import { supabase } from './supabaseClient';
import type { Order } from './orderService';
import { tenantService } from './tenantService';
import type { PaginationResponse } from '../hooks/useServerPagination';

export interface CashRegisterClosure {
    id: string;
    closure_date: string;
    user_id: string;
    user_email: string;
    total_amount: number;
    order_count: number;
    notes?: string;
    created_at: string;
    number?: number;
}

export interface CurrentSession {
    orders: Order[];
    total_amount: number;
    order_count: number;
    last_closure_date: string | null;
}

export const cashRegisterService = {
    /**
     * Obtiene la sesión actual de caja (órdenes confirmadas desde el último cierre)
     */
    async getCurrentSession(): Promise<CurrentSession> {
        // Obtener tenant actual
        const tenant = await tenantService.getUserPrimaryTenant();
        if (!tenant) throw new Error('No se encontró el tenant del usuario');

        // Obtener la fecha del último cierre desde settings
        const settings = await tenantService.getSettings(tenant.id);
        const lastClosureDate = settings.last_cash_closure_date || null;

        // Usar RPC para obtener totales sin límite de 1000
        const { data: sessionData, error: rpcError } = await supabase
            .rpc('get_cash_register_session_total', {
                last_closure_date: lastClosureDate
            })
            .single();

        if (rpcError) throw rpcError;

        const totals = sessionData as { total_amount: number; order_count: number } | null;

        // Obtener las últimas 10 órdenes para mostrar en la UI
        let query = supabase
            .from('orders')
            .select('*, customer:customers(business_name)')
            .eq('status', 'completed')
            .order('order_date', { ascending: false })
            .limit(10);

        if (lastClosureDate) {
            query = query.gt('order_date', lastClosureDate);
        }

        const { data: recentOrders, error: ordersError } = await query;

        if (ordersError) throw ordersError;

        return {
            orders: recentOrders || [],
            total_amount: totals?.total_amount || 0,
            order_count: Number(totals?.order_count) || 0,
            last_closure_date: lastClosureDate
        };
    },

    /**
     * Obtiene los datos detallados de la sesión actual para el reporte de cierre
     */
    async getSessionReportData(): Promise<any> {
        const tenant = await tenantService.getUserPrimaryTenant();
        if (!tenant) throw new Error('No se encontró el tenant del usuario');

        const settings = await tenantService.getSettings(tenant.id);
        const lastClosureDate = settings.last_cash_closure_date || null;

        let query = supabase
            .from('orders')
            .select(`
                *,
                customer:customers(business_name),
                items:order_items(
                    quantity,
                    unit_price,
                    subtotal,
                    product:products(
                        name,
                        category:categories(name)
                    )
                ),
                payment_method:payment_methods(name)
            `)
            .eq('status', 'completed')
            .order('order_date', { ascending: false });

        if (lastClosureDate) {
            query = query.gt('order_date', lastClosureDate);
        }

        const { data: orders, error } = await query;
        if (error) throw error;

        // Calculate totals
        const categoryTotals: Record<string, number> = {};
        const paymentMethodTotals: Record<string, number> = {};
        let total = 0;

        orders?.forEach((order: any) => {
            total += order.total_amount || 0;

            // Payment method totals
            const pmName = order.payment_method?.name || 'Sin método';
            paymentMethodTotals[pmName] = (paymentMethodTotals[pmName] || 0) + (order.total_amount || 0);
            
            // Category totals
            order.items?.forEach((item: any) => {
                const catName = item.product?.category?.name || 'Sin categoría';
                categoryTotals[catName] = (categoryTotals[catName] || 0) + (item.unit_price * item.quantity || 0);
            });
        });

        // Get closure number (count of closures + 1)
        const { count } = await supabase
            .from('cash_register_closures')
            .select('*', { count: 'exact', head: true });
        
        const closureNumber = (count || 0) + 1;

        return {
            nombreEmpresa: settings.company_name || 'Mi Empresa',
            fecha: new Date().toISOString(),
            numeroCierre: closureNumber,
            itemsCategorias: Object.entries(categoryTotals).map(([name, total]) => ({ name, total })),
            itemsMetodoPago: Object.entries(paymentMethodTotals).map(([name, total]) => ({ name, total })),
            total,
            tenantId: tenant.id
        };
    },

    /**
     * Obtiene los datos para imprimir un reporte de cierre histórico
     */
    async getClosureReportData(closureId: string): Promise<any> {
        // 1. Obtener el cierre actual
        const { data: currentClosure, error: closureError } = await supabase
            .from('cash_register_closures')
            .select('*')
            .eq('id', closureId)
            .single();

        if (closureError) throw closureError;

        // 2. Obtener el cierre anterior para determinar el rango de fechas
        const { data: previousClosure } = await supabase
            .from('cash_register_closures')
            .select('closure_date')
            .lt('closure_date', currentClosure.closure_date)
            .order('closure_date', { ascending: false })
            .limit(1)
            .single();

        // 3. Obtener las órdenes en el rango
        let query = supabase
            .from('orders')
            .select(`
                *,
                customer:customers(business_name),
                items:order_items(
                    quantity,
                    unit_price,
                    subtotal,
                    product:products(
                        name,
                        category:categories(name)
                    )
                ),
                payment_method:payment_methods(name)
            `)
            .eq('status', 'completed')
            .lte('order_date', currentClosure.closure_date);

        if (previousClosure) {
            query = query.gt('order_date', previousClosure.closure_date);
        }

        const { data: orders, error: ordersError } = await query;
        if (ordersError) throw ordersError;

        // 4. Calcular totales
        const categoryTotals: Record<string, number> = {};
        const paymentMethodTotals: Record<string, number> = {};
        
        orders?.forEach((order: any) => {
            // Payment method totals
            const pmName = order.payment_method?.name || 'Sin método';
            paymentMethodTotals[pmName] = (paymentMethodTotals[pmName] || 0) + (order.total_amount || 0);

            // Category totals
            order.items?.forEach((item: any) => {
                const catName = item.product?.category?.name || 'Sin categoría';
                categoryTotals[catName] = (categoryTotals[catName] || 0) + (item.unit_price * item.quantity || 0);
            });
        });

        // 5. Obtener configuración del tenant
        let tenantId = currentClosure.tenant_id;
        if (!tenantId) {
             const tenant = await tenantService.getUserPrimaryTenant();
             tenantId = tenant?.id;
        }
        
        const settings = await tenantService.getSettings(tenantId);

        // 6. Calcular número de cierre
        let closureNumber = currentClosure.number;

        if (!closureNumber) {
            const { count } = await supabase
                .from('cash_register_closures')
                .select('*', { count: 'exact', head: true })
                .lte('closure_date', currentClosure.closure_date);
            closureNumber = count || 0;
        }

        return {
            nombreEmpresa: settings.company_name || 'Mi Empresa',
            fecha: currentClosure.closure_date,
            numeroCierre: closureNumber,
            itemsCategorias: Object.entries(categoryTotals).map(([name, total]) => ({ name, total })),
            itemsMetodoPago: Object.entries(paymentMethodTotals).map(([name, total]) => ({ name, total })),
            total: currentClosure.total_amount,
            tenantId: tenantId
        };
    },

    /**
     * Cierra la caja creando un registro y actualizando la fecha de último cierre
     */
    async closeCashRegister(notes?: string): Promise<CashRegisterClosure> {
        // Obtener el usuario actual
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuario no autenticado');

        // Obtener tenant actual
        const tenant = await tenantService.getUserPrimaryTenant();
        if (!tenant) throw new Error('No se encontró el tenant del usuario');

        // Obtener la sesión actual
        const session = await this.getCurrentSession();

        if (session.order_count === 0) {
            throw new Error('No hay órdenes para cerrar la caja');
        }

        // Crear el registro de cierre
        const { data: closure, error: closureError } = await supabase
            .from('cash_register_closures')
            .insert({
                user_id: user.id,
                user_email: user.email,
                total_amount: session.total_amount,
                order_count: session.order_count,
                notes: notes || null
            })
            .select()
            .single();

        if (closureError) throw closureError;

        // Actualizar la fecha del último cierre en settings
        await tenantService.updateSetting(
            tenant.id,
            'last_cash_closure_date',
            new Date().toISOString()
        );

        return closure as CashRegisterClosure;
    },

    /**
     * Obtiene el historial de cierres de caja
     */
    async getClosureHistory(): Promise<CashRegisterClosure[]> {
        const { data, error } = await supabase
            .from('cash_register_closures')
            .select('*')
            .order('closure_date', { ascending: false });

        if (error) throw error;
        return data as CashRegisterClosure[];
    },

    /**
     * Obtiene el historial de cierres con paginación
     */
    async getClosureHistoryPaginated(page: number = 1, pageSize: number = 10): Promise<PaginationResponse<CashRegisterClosure>> {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const { count } = await supabase
            .from('cash_register_closures')
            .select('*', { count: 'exact', head: true });

        const { data, error } = await supabase
            .from('cash_register_closures')
            .select('*')
            .order('closure_date', { ascending: false })
            .range(from, to);

        if (error) throw error;

        return {
            data: data as CashRegisterClosure[],
            total: count || 0,
            page,
            pageSize,
            totalPages: Math.ceil((count || 0) / pageSize),
        };
    },

    /**
     * Obtiene un cierre específico por ID
     */
    async getClosureById(id: string): Promise<CashRegisterClosure> {
        const { data, error } = await supabase
            .from('cash_register_closures')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as CashRegisterClosure;
    }
};
