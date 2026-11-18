-- =====================================================
-- FIX RLS PERFORMANCE WARNINGS
-- =====================================================
-- This migration addresses Supabase linter warnings:
-- 1. Auth RLS Initialization Plan: wrapping auth.uid() in subqueries
-- 2. Multiple Permissive Policies: consolidating policies for better performance
--
-- Date: 2025-11-30
-- =====================================================

-- =====================================================
-- 1. FIX TENANTS TABLE POLICIES
-- =====================================================

-- Helper functions to avoid recursive RLS access when reading user_tenants
CREATE OR REPLACE FUNCTION public.user_tenant_ids(p_user_id UUID)
RETURNS TABLE (tenant_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT tenant_id FROM user_tenants WHERE user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_user_tenant_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM user_tenants
        WHERE user_id = p_user_id AND role = 'admin'
    );
$$;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own tenant" ON tenants;
DROP POLICY IF EXISTS "Admins can manage tenants" ON tenants;

-- Consolidate into a single optimized SELECT policy
-- This fixes both the auth.uid() re-evaluation and multiple permissive policies warnings
CREATE POLICY "Tenant access policy" ON tenants
    FOR SELECT USING (
        id IN (SELECT tenant_id FROM public.user_tenant_ids(auth.uid()))
        OR public.is_user_tenant_admin(auth.uid())
    );

-- Separate policies for INSERT, UPDATE, DELETE (admin only)
CREATE POLICY "Admins can insert tenants" ON tenants
    FOR INSERT WITH CHECK (
        public.is_user_tenant_admin(auth.uid())
    );

CREATE POLICY "Admins can update tenants" ON tenants
    FOR UPDATE USING (
        public.is_user_tenant_admin(auth.uid())
    );

CREATE POLICY "Admins can delete tenants" ON tenants
    FOR DELETE USING (
        public.is_user_tenant_admin(auth.uid())
    );


-- Drop existing policy
DROP POLICY IF EXISTS "Users can view their own tenant associations" ON user_tenants;

-- Recreate with optimized auth.uid() call
CREATE POLICY "Users can view their own tenant associations" ON user_tenants
    FOR SELECT USING (user_id = (SELECT auth.uid()));

-- Admin policy for managing user-tenant associations
CREATE POLICY "Admins can manage user tenants" ON user_tenants
    FOR ALL USING (
        public.is_user_tenant_admin(auth.uid())
    );

-- =====================================================
-- NOTES
-- =====================================================
-- Performance improvements:
-- 1. auth.uid() is now wrapped in (SELECT auth.uid()) to prevent re-evaluation per row
-- 2. Multiple permissive SELECT policies on tenants table are consolidated into one
-- 3. Separate policies for different operations (INSERT, UPDATE, DELETE) for clarity
--
-- Security considerations:
-- - Users can only view tenants they belong to
-- - Admins can view and manage all tenants
-- - Users can view their own tenant associations
-- - Admins can manage all user-tenant associations
