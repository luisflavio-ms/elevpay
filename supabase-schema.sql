-- =====================================================================
-- ELEVPAY — Schema completo (rode no SQL Editor após supabase-setup.sql)
-- Todas as tabelas: uuid, vinculadas a auth.users, RLS por user_id
-- =====================================================================

-- Helper: trigger genérico de updated_at (já criado em supabase-setup.sql,
-- mas garantimos a existência aqui de forma idempotente)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- =====================================================================
-- 1) PRODUCTS
-- =====================================================================
create type public.product_type as enum ('digital', 'fisico', 'assinatura');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  price numeric(12,2) not null default 0,
  image text,
  type public.product_type not null default 'digital',
  delivery_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_user_id_idx on public.products(user_id);

alter table public.products enable row level security;

create policy "Products: owner select" on public.products
  for select using (auth.uid() = user_id);
create policy "Products: owner insert" on public.products
  for insert with check (auth.uid() = user_id);
create policy "Products: owner update" on public.products
  for update using (auth.uid() = user_id);
create policy "Products: owner delete" on public.products
  for delete using (auth.uid() = user_id);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 2) ORDER BUMPS (oferta adicional usada nos checkouts)
-- =====================================================================
create table public.order_bumps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  price numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index order_bumps_user_id_idx on public.order_bumps(user_id);

alter table public.order_bumps enable row level security;

create policy "OrderBumps: owner select" on public.order_bumps
  for select using (auth.uid() = user_id);
create policy "OrderBumps: owner insert" on public.order_bumps
  for insert with check (auth.uid() = user_id);
create policy "OrderBumps: owner update" on public.order_bumps
  for update using (auth.uid() = user_id);
create policy "OrderBumps: owner delete" on public.order_bumps
  for delete using (auth.uid() = user_id);

create trigger order_bumps_set_updated_at
  before update on public.order_bumps
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 3) CHECKOUTS
-- =====================================================================
create table public.checkouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  order_bump_id uuid references public.order_bumps(id) on delete set null,

  slug text not null,
  name text not null,
  headline text not null default '',
  subheadline text not null default '',
  image text,
  benefits jsonb not null default '[]'::jsonb,
  testimonials jsonb not null default '[]'::jsonb,
  guarantee text not null default '',
  primary_color text not null default '#7c3aed',
  button_text text not null default 'Comprar agora',
  payment_methods jsonb not null default '{"pix":true,"card":true,"boleto":false}'::jsonb,

  pixel_meta text,
  pixel_google text,
  webhook_url text,
  redirect_url text,

  scarcity_timer_minutes integer not null default 0,
  secure_seal boolean not null default true,
  urgency_message text not null default '',
  active boolean not null default true,

  conversion numeric(6,2) not null default 0,
  revenue numeric(14,2) not null default 0,

  blocks jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, slug)
);

create index checkouts_user_id_idx on public.checkouts(user_id);
create index checkouts_slug_idx on public.checkouts(slug);

alter table public.checkouts enable row level security;

-- Owner: tudo
create policy "Checkouts: owner select" on public.checkouts
  for select using (auth.uid() = user_id);
create policy "Checkouts: owner insert" on public.checkouts
  for insert with check (auth.uid() = user_id);
create policy "Checkouts: owner update" on public.checkouts
  for update using (auth.uid() = user_id);
create policy "Checkouts: owner delete" on public.checkouts
  for delete using (auth.uid() = user_id);

-- Público (anon) pode ler checkouts ativos pelo slug
create policy "Checkouts: public read ativos" on public.checkouts
  for select to anon using (active = true);

create trigger checkouts_set_updated_at
  before update on public.checkouts
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 4) ORDERS (pedidos)
-- =====================================================================
create type public.order_status as enum ('aprovado', 'pendente', 'recusado', 'reembolsado');
create type public.payment_method as enum ('pix', 'cartao', 'boleto');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkout_id uuid references public.checkouts(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,

  customer_name text not null,
  customer_email text,
  customer_document text,
  customer_phone text,

  amount numeric(12,2) not null default 0,
  status public.order_status not null default 'pendente',
  method public.payment_method not null default 'pix',

  -- UTMs (úteis pra Utmify)
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,

  external_id text, -- id no gateway de pagamento
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_user_id_idx on public.orders(user_id);
create index orders_checkout_id_idx on public.orders(checkout_id);
create index orders_status_idx on public.orders(status);
create index orders_created_at_idx on public.orders(created_at desc);

alter table public.orders enable row level security;

create policy "Orders: owner select" on public.orders
  for select using (auth.uid() = user_id);
create policy "Orders: owner insert" on public.orders
  for insert with check (auth.uid() = user_id);
create policy "Orders: owner update" on public.orders
  for update using (auth.uid() = user_id);
create policy "Orders: owner delete" on public.orders
  for delete using (auth.uid() = user_id);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 5) SALES (vendas — registro financeiro dos pedidos aprovados)
-- =====================================================================
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,

  gross_amount numeric(12,2) not null default 0,
  fee_amount numeric(12,2) not null default 0,
  net_amount numeric(12,2) not null default 0,

  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index sales_user_id_idx on public.sales(user_id);
create index sales_order_id_idx on public.sales(order_id);
create index sales_paid_at_idx on public.sales(paid_at desc);

alter table public.sales enable row level security;

create policy "Sales: owner select" on public.sales
  for select using (auth.uid() = user_id);
create policy "Sales: owner insert" on public.sales
  for insert with check (auth.uid() = user_id);
create policy "Sales: owner update" on public.sales
  for update using (auth.uid() = user_id);
create policy "Sales: owner delete" on public.sales
  for delete using (auth.uid() = user_id);

-- =====================================================================
-- 6) WEBHOOK CONFIGS (configurações tipo Utmify, Zapier, etc.)
-- =====================================================================
create type public.webhook_provider as enum ('utmify', 'custom', 'zapier', 'make');

create type public.webhook_event as enum (
  'payment.approved',
  'payment.pending',
  'payment.refused',
  'payment.refunded',
  'checkout.created'
);

create table public.webhook_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider public.webhook_provider not null default 'custom',
  name text not null,
  url text not null,
  api_token text,            -- token/credencial (ex.: Utmify API token)
  events public.webhook_event[] not null default '{}',
  headers jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index webhook_configs_user_id_idx on public.webhook_configs(user_id);

alter table public.webhook_configs enable row level security;

create policy "WebhookConfigs: owner select" on public.webhook_configs
  for select using (auth.uid() = user_id);
create policy "WebhookConfigs: owner insert" on public.webhook_configs
  for insert with check (auth.uid() = user_id);
create policy "WebhookConfigs: owner update" on public.webhook_configs
  for update using (auth.uid() = user_id);
create policy "WebhookConfigs: owner delete" on public.webhook_configs
  for delete using (auth.uid() = user_id);

create trigger webhook_configs_set_updated_at
  before update on public.webhook_configs
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 7) WEBHOOK LOGS (histórico de disparos)
-- =====================================================================
create table public.webhook_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  webhook_config_id uuid references public.webhook_configs(id) on delete set null,
  event public.webhook_event not null,
  status_code integer,
  success boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  response jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index webhook_logs_user_id_idx on public.webhook_logs(user_id);
create index webhook_logs_created_at_idx on public.webhook_logs(created_at desc);

alter table public.webhook_logs enable row level security;

create policy "WebhookLogs: owner select" on public.webhook_logs
  for select using (auth.uid() = user_id);
create policy "WebhookLogs: owner insert" on public.webhook_logs
  for insert with check (auth.uid() = user_id);
create policy "WebhookLogs: owner delete" on public.webhook_logs
  for delete using (auth.uid() = user_id);

-- =====================================================================
-- 8) USER SETTINGS (configurações da conta/empresa)
-- =====================================================================
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_name text,
  logo text,
  custom_domain text,
  fee_percent numeric(5,2) not null default 0,
  withdraw_account text,
  pix_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "UserSettings: owner select" on public.user_settings
  for select using (auth.uid() = user_id);
create policy "UserSettings: owner insert" on public.user_settings
  for insert with check (auth.uid() = user_id);
create policy "UserSettings: owner update" on public.user_settings
  for update using (auth.uid() = user_id);

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- =====================================================================
-- FIM
-- =====================================================================
