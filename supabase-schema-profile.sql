-- =====================================================================
-- Expansão da tabela profiles para "Meu Perfil".
-- Rode no SQL Editor do Supabase APÓS supabase-setup.sql.
-- =====================================================================

alter table public.profiles
  add column if not exists cpf text,
  add column if not exists birth_date date,
  add column if not exists email text,
  add column if not exists whatsapp text,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists notifications_enabled boolean not null default true,
  add column if not exists support_email text,
  add column if not exists support_whatsapp text,
  add column if not exists support_social text;
