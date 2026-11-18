import { supabase } from './supabaseClient';
import type { OrderPayment, CreateOrderPaymentInput } from '../types/paymentMethod';

class OrderPaymentService {
    private tableName = 'order_payments';

    async getByOrderId(orderId: string): Promise<OrderPayment[]> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select('*, payment_method:payment_methods(*)')
            .eq('order_id', orderId);

        if (error) throw error;
        return data || [];
    }

    async createMultiple(orderId: string, payments: CreateOrderPaymentInput[]): Promise<OrderPayment[]> {
        if (payments.length === 0) return [];

        const paymentsToInsert = payments.map(p => ({
            order_id: orderId,
            payment_method_id: p.payment_method_id,
            amount: p.amount,
        }));

        const { data, error } = await supabase
            .from(this.tableName)
            .insert(paymentsToInsert)
            .select('*, payment_method:payment_methods(*)');

        if (error) throw error;
        return data || [];
    }

    async deleteByOrderId(orderId: string): Promise<void> {
        const { error } = await supabase
            .from(this.tableName)
            .delete()
            .eq('order_id', orderId);

        if (error) throw error;
    }

    async hasAutoInvoicePayment(orderId: string): Promise<boolean> {
        const { data, error } = await supabase
            .from(this.tableName)
            .select('payment_method:payment_methods(auto_invoice)')
            .eq('order_id', orderId);

        if (error) throw error;
        return data?.some((p: any) => p.payment_method?.auto_invoice) || false;
    }
}

export const orderPaymentService = new OrderPaymentService();
