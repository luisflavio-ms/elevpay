-- Setup
create type public.app_role as enum ('admin', 'user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  cpf text,
  birth_date date,
  email text,
  whatsapp text,
  address text,
  city text,
  state text,
  notifications_enabled boolean not null default true,
  support_email text,
  support_whatsapp text,
  support_social text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles: select own" on public.profiles for select using (auth.uid() = id);
create policy "Profiles: update own" on public.profiles for update using (auth.uid() = id);
create policy "Profiles: insert own" on public.profiles for insert with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Roles: select own" on public.user_roles for select using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email);
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Products
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
create policy "Products: owner all" on public.products for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();

-- Order bumps
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
create policy "OrderBumps: owner all" on public.order_bumps for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger order_bumps_set_updated_at before update on public.order_bumps for each row execute function public.set_updated_at();

-- Checkouts
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
create policy "Checkouts: owner all" on public.checkouts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Checkouts: public read ativos" on public.checkouts for select to anon using (active = true);
create trigger checkouts_set_updated_at before update on public.checkouts for each row execute function public.set_updated_at();

create policy "Products: public read via active checkout" on public.products for select to anon, authenticated
  using (exists (select 1 from public.checkouts c where c.product_id = products.id and c.active = true));
create policy "OrderBumps: public read via active checkout" on public.order_bumps for select to anon, authenticated
  using (exists (select 1 from public.checkouts c where c.order_bump_id = order_bumps.id and c.active = true));

-- Orders
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
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  external_id text,
  abacate_billing_id text,
  pix_qr_code text,
  pix_copy_paste text,
  pix_expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_user_id_idx on public.orders(user_id);
create index orders_checkout_id_idx on public.orders(checkout_id);
create index orders_status_idx on public.orders(status);
create index orders_created_at_idx on public.orders(created_at desc);
create index orders_abacate_billing_id_idx on public.orders(abacate_billing_id);
alter table public.orders enable row level security;
create policy "Orders: owner all" on public.orders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Orders: public read by billing id" on public.orders for select to anon using (abacate_billing_id is not null);
create policy "Orders: public insert pending" on public.orders for insert to anon with check (status = 'pendente');
create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();

-- Sales
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
alter table public.sales enable row level security;
create policy "Sales: owner all" on public.sales for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Webhook configs
create type public.webhook_provider as enum ('utmify', 'custom', 'zapier', 'make');
create type public.webhook_event as enum ('payment.approved','payment.pending','payment.refused','payment.refunded','checkout.created');

create table public.webhook_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider public.webhook_provider not null default 'custom',
  name text not null,
  url text not null,
  api_token text,
  events public.webhook_event[] not null default '{}',
  headers jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index webhook_configs_user_id_idx on public.webhook_configs(user_id);
alter table public.webhook_configs enable row level security;
create policy "WebhookConfigs: owner all" on public.webhook_configs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger webhook_configs_set_updated_at before update on public.webhook_configs for each row execute function public.set_updated_at();

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
alter table public.webhook_logs enable row level security;
create policy "WebhookLogs: owner select" on public.webhook_logs for select using (auth.uid() = user_id);
create policy "WebhookLogs: owner insert" on public.webhook_logs for insert with check (auth.uid() = user_id);