-- Create tax detail table for fiscal documents

CREATE TABLE IF NOT EXISTS public.fiscal_documents_detail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_document_id UUID NOT NULL REFERENCES public.fiscal_documents(id) ON DELETE CASCADE,
    tax_rate_type_id INTEGER NULL REFERENCES public.tax_rate_types(id) ON DELETE SET NULL,
    tax_percentage NUMERIC(6, 3) NOT NULL DEFAULT 0,
    base_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tenant_id UUID NULL REFERENCES public.tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fdoc_detail_fiscal_document_id ON public.fiscal_documents_detail(fiscal_document_id);
CREATE INDEX IF NOT EXISTS idx_fdoc_detail_tax_rate_type_id ON public.fiscal_documents_detail(tax_rate_type_id);
CREATE INDEX IF NOT EXISTS idx_fdoc_detail_tenant_id ON public.fiscal_documents_detail(tenant_id);

ALTER TABLE public.fiscal_documents_detail ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_select ON public.fiscal_documents_detail;
CREATE POLICY tenant_isolation_select ON public.fiscal_documents_detail
    FOR SELECT USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_insert ON public.fiscal_documents_detail;
CREATE POLICY tenant_isolation_insert ON public.fiscal_documents_detail
    FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_update ON public.fiscal_documents_detail;
CREATE POLICY tenant_isolation_update ON public.fiscal_documents_detail
    FOR UPDATE USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_delete ON public.fiscal_documents_detail;
CREATE POLICY tenant_isolation_delete ON public.fiscal_documents_detail
    FOR DELETE USING (tenant_id = public.get_user_tenant_id());

DROP TRIGGER IF EXISTS update_fiscal_documents_detail_updated_at ON public.fiscal_documents_detail;
CREATE TRIGGER update_fiscal_documents_detail_updated_at
    BEFORE UPDATE ON public.fiscal_documents_detail
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_tenant_id_fiscal_documents_detail ON public.fiscal_documents_detail;
CREATE TRIGGER set_tenant_id_fiscal_documents_detail
    BEFORE INSERT ON public.fiscal_documents_detail
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_set_tenant_id();
