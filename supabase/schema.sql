-- Budget Couple : schéma Supabase (à exécuter dans SQL Editor)
-- Un "espace" = un document JSON partagé, identifié par un code secret.
create table if not exists public.budget_spaces (
  code text primary key check (length(code) >= 8),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.budget_spaces enable row level security;

-- Politiques simples : la clé anon peut lire/écrire une ligne si elle connaît son code
-- (l'appli filtre toujours par code). Ne partagez le code qu'entre vous deux.
drop policy if exists "lecture par code" on public.budget_spaces;
drop policy if exists "insertion" on public.budget_spaces;
drop policy if exists "mise a jour" on public.budget_spaces;
create policy "lecture par code" on public.budget_spaces for select to anon using (true);
create policy "insertion" on public.budget_spaces for insert to anon with check (length(code) >= 8);
create policy "mise a jour" on public.budget_spaces for update to anon using (true) with check (length(code) >= 8);
-- Pas de politique DELETE : la suppression est interdite depuis l'appli.
