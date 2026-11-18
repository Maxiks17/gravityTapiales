-- Función para obtener el total de ventas del mes
CREATE OR REPLACE FUNCTION get_month_sales_total(
    start_date timestamptz,
    end_date timestamptz
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_sales numeric;
    current_tenant_id uuid;
BEGIN
    -- Obtener el tenant_id del usuario autenticado
    current_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
    
    SELECT COALESCE(SUM(total_amount), 0)
    INTO total_sales
    FROM orders
    WHERE order_date >= start_date
    AND order_date <= end_date
    AND status = 'completed'
    AND (current_tenant_id IS NULL OR tenant_id = current_tenant_id);
    
    RETURN total_sales;
END;
$$;

-- Función para contar pedidos del mes
CREATE OR REPLACE FUNCTION get_month_orders_count(
    start_date timestamptz,
    end_date timestamptz
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    orders_count bigint;
    current_tenant_id uuid;
BEGIN
    -- Obtener el tenant_id del usuario autenticado
    current_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
    
    SELECT COUNT(*)
    INTO orders_count
    FROM orders
    WHERE order_date >= start_date
    AND order_date <= end_date
    AND status = 'completed'
    AND (current_tenant_id IS NULL OR tenant_id = current_tenant_id);
    
    RETURN orders_count;
END;
$$;

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION get_month_sales_total(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_month_orders_count(timestamptz, timestamptz) TO authenticated;

-- Función para obtener el total de ventas en caja desde una fecha
CREATE OR REPLACE FUNCTION get_cash_register_session_total(
    last_closure_date timestamptz
)
RETURNS TABLE(total_amount numeric, order_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_tenant_id uuid;
BEGIN
    -- Obtener el tenant_id del usuario autenticado
    current_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
    
    RETURN QUERY
    SELECT 
        COALESCE(SUM(orders.total_amount), 0) as total_amount,
        COUNT(*)::bigint as order_count
    FROM orders
    WHERE orders.status = 'completed'
    AND (current_tenant_id IS NULL OR orders.tenant_id = current_tenant_id)
    AND (
        last_closure_date IS NULL 
        OR orders.order_date > last_closure_date
    );
END;
$$;

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION get_cash_register_session_total(timestamptz) TO authenticated;
