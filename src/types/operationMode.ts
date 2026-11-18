// Operation Mode types for multi-mode business support

export type OperationMode = 'RESTAURANTE' | 'KIOSCO' | 'DISTRIBUIDOR';

export type TableStatus = 'FREE' | 'OCCUPIED' | 'RESERVED' | 'WAITING_PAYMENT';

export type TableShape = 'rectangle' | 'round' | 'square';

export type OrderLifecycleStatus =
    | 'open'       // Restaurant: order in progress at a table
    | 'pending'    // Distributor: awaiting delivery
    | 'confirmed'  // Legacy/general: order confirmed
    | 'preparing'  // Legacy/general: being prepared
    | 'shipped'    // Legacy/general: shipped
    | 'delivered'  // Distributor: delivered to customer
    | 'completed'  // All modes: final closed state
    | 'cancelled'; // All modes: cancelled

export interface Table {
    id: string;
    tenant_id: string;
    name: string;
    status: TableStatus;
    capacity: number;
    location?: string; // KEEPING AS LEGACY LABEL
    area_id?: string;
    position_x: number;
    position_y: number;
    width: number;
    height: number;
    rotation: number;
    shape: TableShape;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
    // Virtual field for UI
    current_order?: {
        id: string;
        order_number: string;
        total_amount: number;
        items_count: number;
    };
}

export interface Area {
    id: string;
    tenant_id: string;
    name: string;
    floor?: string; // Legacy/Display
    parent_id?: string;
    // Positioning on Master Map
    position_x?: number;
    position_y?: number;
    width?: number;
    height?: number;
    // ---
    sort_order: number;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface CreateAreaInput {
    name: string;
    floor?: string;
    parent_id?: string;
    position_x?: number;
    position_y?: number;
    width?: number;
    height?: number;
    sort_order?: number;
}

export interface UpdateAreaInput {
    name?: string;
    floor?: string;
    parent_id?: string;
    position_x?: number;
    position_y?: number;
    width?: number;
    height?: number;
    sort_order?: number;
    is_active?: boolean;
}

export interface CreateTableInput {
    name: string;
    capacity?: number;
    location?: string;
    area_id?: string;
    position_x?: number;
    position_y?: number;
    width?: number;
    height?: number;
    rotation?: number;
    shape?: TableShape;
}

export interface UpdateTableInput {
    name?: string;
    status?: TableStatus;
    capacity?: number;
    location?: string;
    area_id?: string;
    position_x?: number;
    position_y?: number;
    width?: number;
    height?: number;
    rotation?: number;
    shape?: TableShape;
    is_active?: boolean;
}

// Staff / Personal types
export type StaffPosition = 'waiter' | 'cashier' | 'cook' | 'manager' | 'host' | 'bartender' | 'cleaner';

export interface Staff {
    id: string;
    tenant_id: string;
    user_id?: string | null;
    first_name: string;
    last_name?: string;
    email?: string;
    phone?: string;
    position: StaffPosition;
    hire_date?: string;
    is_active: boolean;
    notes?: string;
    created_at?: string;
    updated_at?: string;
}

export interface CreateStaffInput {
    first_name: string;
    last_name?: string;
    email?: string;
    phone?: string;
    position: StaffPosition;
    hire_date?: string;
    notes?: string;
}

export interface UpdateStaffInput {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    position?: StaffPosition;
    hire_date?: string;
    is_active?: boolean;
    notes?: string;
}

// Operation mode specific order creation
export interface CreateOrderByMode {
    mode: OperationMode;
    table_id?: string;      // Required for RESTAURANTE
    customer_id?: string;   // Optional for KIOSCO, may be required for DISTRIBUIDOR
    items: {
        product_id: string;
        quantity: number;
        unit_price: number;
        subtotal: number;
    }[];
    subtotal: number;
    tax_amount: number;
    total_amount: number;
    notes?: string;
}

// Default settings for operation modes
export const OperationModeDefaults: Record<OperationMode, {
    showTables: boolean;
    defaultOrderStatus: OrderLifecycleStatus;
    requiresDeliveryConfirmation: boolean;
    customerRequired: boolean;
}> = {
    RESTAURANTE: {
        showTables: true,
        defaultOrderStatus: 'open',
        requiresDeliveryConfirmation: false,
        customerRequired: false,
    },
    KIOSCO: {
        showTables: false,
        defaultOrderStatus: 'completed',
        requiresDeliveryConfirmation: false,
        customerRequired: false,
    },
    DISTRIBUIDOR: {
        showTables: false,
        defaultOrderStatus: 'pending',
        requiresDeliveryConfirmation: true,
        customerRequired: true,
    },
};
