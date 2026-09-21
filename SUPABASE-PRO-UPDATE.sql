-- PUNTO YA CR · Actualización PRO
-- Ejecutar UNA VEZ en Supabase SQL Editor.
-- No modifica las tablas existentes del POS; agrega estructura del Panel PRO.

create extension if not exists pgcrypto;

create table if not exists public.business_expenses (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  description text not null, category text, total numeric(14,2) not null default 0, tax numeric(14,2) not null default 0,
  condition text not null default 'cash' check (condition in ('cash','credit')),
  expense_date date not null default current_date, due_date date, supplier_id uuid, notes text, voided boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.business_suppliers (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null, tax_id text, phone text, email text, contact_name text, usual_credit_days integer, notes text, active boolean not null default true,
  created_at timestamptz not null default now(), unique(business_id,name)
);
create table if not exists public.supplier_invoices (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid references public.business_suppliers(id) on delete set null, document_number text, electronic_key text,
  invoice_date date not null default current_date, due_date date, condition text not null default 'cash' check(condition in ('cash','credit')),
  subtotal numeric(14,2) not null default 0, discount numeric(14,2) not null default 0, tax numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0, balance_due numeric(14,2) not null default 0, currency text not null default 'CRC',
  document_url text, xml_url text, voided boolean not null default false, notes text, created_at timestamptz not null default now()
);
create table if not exists public.supplier_payments (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_id uuid references public.supplier_invoices(id) on delete cascade, amount numeric(14,2) not null check(amount>0),
  method text, payment_date date not null default current_date, reference text, notes text, created_at timestamptz not null default now()
);
create table if not exists public.business_growth_goals (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  goal_type text not null default 'sales_monthly', target_amount numeric(14,2) not null check(target_amount>0),
  period_start date not null, period_end date, active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.business_accountants (
  business_id uuid primary key references public.businesses(id) on delete cascade, name text not null, email text, phone text,
  notes text, updated_at timestamptz not null default now()
);

-- RLS: solo miembros activos del mismo negocio. Escritura limitada al owner.
do $$ declare t text; begin
  foreach t in array array['business_expenses','business_suppliers','supplier_invoices','supplier_payments','business_growth_goals','business_accountants'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists %I on public.%I','member_read_'||t,t);
    execute format('create policy %I on public.%I for select using (exists (select 1 from public.business_members bm where bm.business_id = %I.business_id and bm.user_id = auth.uid() and bm.active = true))','member_read_'||t,t,t);
    execute format('drop policy if exists %I on public.%I','owner_write_'||t,t);
    execute format('create policy %I on public.%I for all using (exists (select 1 from public.business_members bm where bm.business_id = %I.business_id and bm.user_id = auth.uid() and bm.active = true and bm.role = ''owner'')) with check (exists (select 1 from public.business_members bm where bm.business_id = %I.business_id and bm.user_id = auth.uid() and bm.active = true and bm.role = ''owner''))','owner_write_'||t,t,t,t);
  end loop;
end $$;

create index if not exists idx_expenses_business_date on public.business_expenses(business_id,expense_date desc);
create index if not exists idx_supplier_invoices_business_due on public.supplier_invoices(business_id,due_date);
create index if not exists idx_supplier_payments_business_date on public.supplier_payments(business_id,payment_date desc);
