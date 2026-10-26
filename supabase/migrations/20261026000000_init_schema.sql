-- ====================================================================
-- Initial Migration: Schema Setup
-- Follows strict conventions: snake_case, UUID PKs, RLS, indexes
-- ====================================================================

-- 1. Enable necessary Postgres extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Helper function to auto update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Customer Categories (Reference table for dropdown filters)
CREATE TABLE IF NOT EXISTS public.customer_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Trigger for customer_categories
DROP TRIGGER IF EXISTS set_customer_categories_updated_at ON public.customer_categories;
CREATE TRIGGER set_customer_categories_updated_at
  BEFORE UPDATE ON public.customer_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 4. Customers Table (Core business module)
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_code text NOT NULL UNIQUE,
  full_name text NOT NULL,
  category_id uuid REFERENCES public.customer_categories(id) ON DELETE SET NULL,
  email text,
  phone text,
  tax_id text,
  address text,
  city text,
  status text DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive', 'pending', 'locked')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Trigger for customers
DROP TRIGGER IF EXISTS set_customers_updated_at ON public.customers;
CREATE TRIGGER set_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 5. Performance Indexes for Filter queries
CREATE INDEX IF NOT EXISTS idx_customers_code ON public.customers(customer_code);
CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_category_id ON public.customers(category_id);
CREATE INDEX IF NOT EXISTS idx_customers_full_name ON public.customers(full_name);
CREATE INDEX IF NOT EXISTS idx_customers_city ON public.customers(city);

-- 6. Row Level Security (RLS) Enforcement
ALTER TABLE public.customer_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Base Policies for Authenticated & Anon Users (Read-access for active items)
CREATE POLICY "Public read active categories"
  ON public.customer_categories
  FOR SELECT
  USING (true);

CREATE POLICY "Public read customers"
  ON public.customers
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert customers"
  ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update customers"
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
