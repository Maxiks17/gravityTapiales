// Payment Method types

export interface PaymentMethod {
    id: string;
    tenant_id: string;
    name: string;
    description?: string;
    auto_invoice: boolean; // true = digital (auto invoice), false = manual (cash)
    is_active: boolean;
    icon?: string; // lucide icon name
    sort_order: number;
    created_at?: string;
    updated_at?: string;
}

export interface CreatePaymentMethodInput {
    name: string;
    description?: string;
    auto_invoice: boolean;
    is_active?: boolean;
    icon?: string;
    sort_order?: number;
}

export interface UpdatePaymentMethodInput {
    name?: string;
    description?: string;
    auto_invoice?: boolean;
    is_active?: boolean;
    icon?: string;
    sort_order?: number;
}

// Default payment methods for initial setup
export const DEFAULT_PAYMENT_METHODS: Omit<PaymentMethod, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>[] = [
    {
        name: 'Efectivo',
        description: 'Pago en efectivo',
        auto_invoice: false,
        is_active: true,
        icon: 'Banknote',
        sort_order: 1,
    },
    {
        name: 'Tarjeta de Débito',
        description: 'Pago con tarjeta de débito',
        auto_invoice: true,
        is_active: true,
        icon: 'CreditCard',
        sort_order: 2,
    },
    {
        name: 'Tarjeta de Crédito',
        description: 'Pago con tarjeta de crédito',
        auto_invoice: true,
        is_active: true,
        icon: 'CreditCard',
        sort_order: 3,
    },
    {
        name: 'Transferencia',
        description: 'Transferencia bancaria',
        auto_invoice: true,
        is_active: true,
        icon: 'Smartphone',
        sort_order: 4,
    },
    {
        name: 'Mercado Pago',
        description: 'Pago digital con Mercado Pago',
        auto_invoice: true,
        is_active: true,
        icon: 'Smartphone',
        sort_order: 5,
    },
];

// Order Payment for mixed payments support
export interface OrderPayment {
    id: string;
    tenant_id: string;
    order_id: string;
    payment_method_id: string;
    amount: number;
    created_at?: string;
    updated_at?: string;
    payment_method?: PaymentMethod;
}

export interface CreateOrderPaymentInput {
    payment_method_id: string;
    amount: number;
}
