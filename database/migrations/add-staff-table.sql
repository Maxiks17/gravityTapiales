-- Create staff table for employees (with or without system access)
CREATE TABLE IF NOT EXISTS public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Personal information
  first_name varchar(100) NOT NULL,
  last_name varchar(100),
  email varchar(255),
  phone varchar(50),
  
  -- Work information
  position varchar(50) NOT NULL, -- 'waiter', 'cashier', 'cook', 'manager', 'host', 'bartender', 'cleaner'
  hire_date date DEFAULT CURRENT_DATE,
  is_active boolean DEFAULT true,
  
  -- Notes
  notes text,
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Note: No unique constraint on names to allow nicknames and duplicate names
);

-- Add waiter_id to orders
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS waiter_id uuid REFERENCES public.staff(id) ON DELETE SET NULL;

-- Add staff_id to user_tenants for future linking
ALTER TABLE public.user_tenants 
  ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_owner boolean DEFAULT false;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_tenant_id ON public.staff(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_position ON public.staff(position);
CREATE INDEX IF NOT EXISTS idx_staff_is_active ON public.staff(is_active);
CREATE INDEX IF NOT EXISTS idx_staff_user_id ON public.staff(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_waiter_id ON public.orders(waiter_id);

-- Enable RLS
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- RLS Policies for staff
CREATE POLICY "Users can view staff from their tenant"
  ON public.staff FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert staff to their tenant"
  ON public.staff FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update staff from their tenant"
  ON public.staff FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete staff from their tenant"
  ON public.staff FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_staff_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER staff_updated_at
  BEFORE UPDATE ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_updated_at();

-- Comments
COMMENT ON TABLE public.staff IS 'Employees of the restaurant (with or without system access)';
COMMENT ON COLUMN public.staff.user_id IS 'References auth.users - NULL if employee does not have system access';
COMMENT ON COLUMN public.staff.position IS 'Job position: waiter, cashier, cook, manager, host, bartender, cleaner';
COMMENT ON COLUMN public.staff.is_active IS 'Whether the employee is currently active (employed)';
