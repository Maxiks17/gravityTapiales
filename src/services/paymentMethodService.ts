import { supabase } from './supabaseClient';
import type {
    PaymentMethod,
    CreatePaymentMethodInput,
    UpdatePaymentMethodInput
} from '../types/paymentMethod';
import { DEFAULT_PAYMENT_METHODS } from '../types/paymentMethod';
import { cacheService, CACHE_KEYS, CACHE_TTL } from './cacheService';

class PaymentMethodService {
    private tableName = 'payment_methods';

    /**
     * Get all payment methods for current tenant, ordered by usage frequency
     */
    async getAll(): Promise<PaymentMethod[]> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) throw error;
        const methods = data || [];

        // Try to order by cached frequency
        const cachedOrder = cacheService.get<string[]>(CACHE_KEYS.PAYMENT_METHOD_ORDER);
        if (cachedOrder && cachedOrder.length > 0) {
            return this.sortByFrequencyOrder(methods, cachedOrder);
        }

        return methods;
    }

    /**
     * Sort payment methods by frequency order, keeping uncached ones at the end
     */
    private sortByFrequencyOrder(methods: PaymentMethod[], order: string[]): PaymentMethod[] {
        const orderMap = new Map(order.map((id, index) => [id, index]));
        return [...methods].sort((a, b) => {
            const indexA = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
            const indexB = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
            if (indexA === indexB) return a.sort_order - b.sort_order;
            return indexA - indexB;
        });
    }

    /**
     * Calculate and cache payment method order based on usage frequency
     */
    async calculateAndCacheFrequencyOrder(): Promise<void> {
        try {
            const { data: payments, error } = await supabase
                .from('order_payments')
                .select('payment_method_id')
                .order('created_at', { ascending: false })
                .limit(300);

            if (error || !payments || payments.length < 10) {
                return; // Not enough data, use default order
            }

            const frequencyMap = new Map<string, number>();
            payments.forEach(p => {
                const count = frequencyMap.get(p.payment_method_id) || 0;
                frequencyMap.set(p.payment_method_id, count + 1);
            });

            const sortedIds = Array.from(frequencyMap.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([id]) => id);

            cacheService.set(
                CACHE_KEYS.PAYMENT_METHOD_ORDER,
                sortedIds,
                CACHE_TTL.PAYMENT_METHOD_ORDER
            );
        } catch (error) {
            console.warn('Failed to calculate payment method frequency:', error);
        }
    }

    /**
     * Initialize frequency order cache if needed
     */
    async initFrequencyOrder(): Promise<void> {
        const cached = cacheService.get<string[]>(CACHE_KEYS.PAYMENT_METHOD_ORDER);
        if (!cached) {
            await this.calculateAndCacheFrequencyOrder();
        }
    }

    /**
     * Get all payment methods including inactive
     */
    async getAllIncludingInactive(): Promise<PaymentMethod[]> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select('*')
            .order('sort_order', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    /**
     * Get payment method by ID
     */
    async getById(id: string): Promise<PaymentMethod> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Create a new payment method
     */
    async create(input: CreatePaymentMethodInput): Promise<PaymentMethod> {
        const { data, error } = await supabase
            .from(this.tableName)
            .insert([{
                name: input.name,
                description: input.description,
                auto_invoice: input.auto_invoice,
                is_active: input.is_active ?? true,
                icon: input.icon,
                sort_order: input.sort_order ?? 0,
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Update payment method
     */
    async update(id: string, input: UpdatePaymentMethodInput): Promise<PaymentMethod> {
        const { data, error } = await supabase
            .from(this.tableName)
            .update(input)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Delete payment method (soft delete by setting is_active = false)
     */
    async softDelete(id: string): Promise<void> {
        const { error } = await supabase
            .from(this.tableName)
            .update({ is_active: false })
            .eq('id', id);

        if (error) throw error;
    }

    /**
     * Check if a payment method is referenced by any order_payments
     */
    async isUsedInOrders(id: string): Promise<boolean> {
        const { count, error } = await supabase
            .from('order_payments')
            .select('id', { count: 'exact', head: true })
            .eq('payment_method_id', id);

        if (error) throw error;
        return (count ?? 0) > 0;
    }

    /**
     * Hard delete payment method
     */
    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from(this.tableName)
            .delete()
            .eq('id', id);

        if (error) throw error;
    }

    /**
     * Check if tenant has payment methods, if not, create defaults
     */
    async ensureDefaultPaymentMethods(tenantId: string): Promise<void> {
        const { data: existing } = await supabase
            .from(this.tableName)
            .select('id')
            .eq('tenant_id', tenantId)
            .limit(1);

        // If no payment methods exist, create defaults
        if (!existing || existing.length === 0) {
            const methodsToInsert = DEFAULT_PAYMENT_METHODS.map((method) => ({
                tenant_id: tenantId,
                ...method,
            }));

            const { error } = await supabase
                .from(this.tableName)
                .insert(methodsToInsert);

            if (error) {
                console.error('Error creating default payment methods:', error);
                throw error;
            }
        }
    }

    /**
     * Reorder payment methods
     */
    async reorder(paymentMethodIds: string[]): Promise<void> {
        const updates = paymentMethodIds.map((id, index) => 
            supabase
                .from(this.tableName)
                .update({ sort_order: index })
                .eq('id', id)
        );

        await Promise.all(updates);
    }
}

export const paymentMethodService = new PaymentMethodService();
