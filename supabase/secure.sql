-- Budget Couple v13 : sécurité renforcée (à exécuter UNE fois dans Supabase > SQL Editor,
-- APRÈS schema.sql et storage.sql). Ré-exécutable sans risque (idempotent).
--
-- Ce script NE SUPPRIME AUCUNE ligne, AUCUN fichier, NE MODIFIE AUCUNE donnée :
-- il remplace seulement des droits d'accès (policies / GRANT) et ajoute 3 fonctions.
--
-- AVANT : la clé publishable (publique, visible dans l'appli) permettait de LISTER tous
--         les espaces (select using(true)), d'écraser n'importe lequel, et de lister /
--         télécharger / supprimer tous les fichiers du bucket « documents ».
-- APRÈS : - plus aucun accès direct à la table pour anon/authenticated ;
--         - lecture/écriture uniquement via get_space / save_space / sync_ts, qui exigent
--           le code EXACT (impossible de lister ou de deviner les codes existants autrement
--           qu'en les essayant un par un) ;
--         - Storage : lister le bucket est interdit ; lire / remplacer / supprimer un
--           fichier n'est possible qu'en connaissant son chemin complet, dont le dossier est
--           une empreinte SHA-256 (128 bits) du code d'espace.
-- LIMITE : la protection repose entièrement sur le secret du code d'espace. Un code court
--          ou devinable (prénoms + date) peut être trouvé par essais. Utilisez le bouton
--          « Changer le code d'espace » de l'appli (code aléatoire de 128 bits).
--          Il n'y a pas de comptes utilisateurs : quiconque a le code (et la clé publique)
--          a un accès complet à l'espace.

-- 1) Fonctions RPC (SECURITY DEFINER : s'exécutent avec les droits du propriétaire)
create or replace function public.get_space(p_code text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('data', s.data, 'updated_at', s.updated_at)
  from public.budget_spaces s
  where length(p_code) >= 8 and s.code = p_code;
$$;

create or replace function public.sync_ts(p_code text)
returns timestamptz language sql stable security definer set search_path = public, pg_temp as $$
  select s.updated_at from public.budget_spaces s where length(p_code) >= 8 and s.code = p_code;
$$;

-- Verrou optimiste : p_expected = updated_at lu juste avant (null = création d'un espace).
-- Renvoie {"ok":true,"updated_at":...} ou {"ok":false,"updated_at":<valeur actuelle>}.
create or replace function public.save_space(p_code text, p_data jsonb, p_expected timestamptz)
returns jsonb language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_ts timestamptz;
begin
  if p_code is null or length(p_code) < 8 then raise exception 'code trop court' using errcode = '23514'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'données invalides' using errcode = '22023'; end if;
  if p_expected is null then
    insert into public.budget_spaces(code, data, updated_at) values (p_code, p_data, clock_timestamp())
    on conflict (code) do nothing returning updated_at into v_ts;
  else
    update public.budget_spaces set data = p_data, updated_at = clock_timestamp()
    where code = p_code and updated_at = p_expected returning updated_at into v_ts;
  end if;
  if v_ts is not null then return jsonb_build_object('ok', true, 'updated_at', v_ts); end if;
  return jsonb_build_object('ok', false, 'updated_at', (select updated_at from public.budget_spaces where code = p_code));
end $$;

revoke all on function public.get_space(text) from public;
revoke all on function public.sync_ts(text) from public;
revoke all on function public.save_space(text, jsonb, timestamptz) from public;
grant execute on function public.get_space(text) to anon, authenticated;
grant execute on function public.sync_ts(text) to anon, authenticated;
grant execute on function public.save_space(text, jsonb, timestamptz) to anon, authenticated;

-- 2) Table : plus d'accès direct (RLS reste activée, aucune ligne touchée)
alter table public.budget_spaces enable row level security;
drop policy if exists "lecture par code" on public.budget_spaces;
drop policy if exists "insertion" on public.budget_spaces;
drop policy if exists "mise a jour" on public.budget_spaces;
revoke select, insert, update, delete, truncate, references, trigger on public.budget_spaces from anon, authenticated;

-- 3) Storage : pas de listing ; accès seulement au chemin exact (dossier = empreinte du code)
create or replace function public.bc_doc_op_allowed(p_ops text[])
returns boolean language sql stable set search_path = pg_catalog, pg_temp as $$
  select coalesce(regexp_replace(current_setting('storage.operation', true), '^storage\.', '') = any(p_ops), false);
$$;
grant execute on function public.bc_doc_op_allowed(text[]) to anon, authenticated;

drop policy if exists "budget_couple_docs_select" on storage.objects;
drop policy if exists "budget_couple_docs_insert" on storage.objects;
drop policy if exists "budget_couple_docs_update" on storage.objects;
drop policy if exists "budget_couple_docs_delete" on storage.objects;

create policy "budget_couple_docs_select" on storage.objects for select to anon
  using (bucket_id = 'documents' and (storage.foldername(name))[1] ~ '^[0-9a-f]{32}$'
    and public.bc_doc_op_allowed(array['object.get_authenticated','object.get_authenticated_info',
      'object.head_authenticated_info','object.info_authenticated','object.upload','object.upload_update',
      'object.delete','object.delete_many']));
create policy "budget_couple_docs_insert" on storage.objects for insert to anon
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] ~ '^[0-9a-f]{32}$');
create policy "budget_couple_docs_update" on storage.objects for update to anon
  using (bucket_id = 'documents' and (storage.foldername(name))[1] ~ '^[0-9a-f]{32}$'
    and public.bc_doc_op_allowed(array['object.upload','object.upload_update']))
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] ~ '^[0-9a-f]{32}$');
create policy "budget_couple_docs_delete" on storage.objects for delete to anon
  using (bucket_id = 'documents' and (storage.foldername(name))[1] ~ '^[0-9a-f]{32}$'
    and public.bc_doc_op_allowed(array['object.delete','object.delete_many']));

-- 4) Vérification (LECTURE SEULE) — à lancer séparément après le script :
-- select count(*) as espaces_conserves from public.budget_spaces;
-- select count(*) as fichiers_conserves from storage.objects where bucket_id = 'documents';
-- select has_table_privilege('anon','public.budget_spaces','select') as anon_lit_table_directement; -- attendu : false
-- select proname, prosecdef from pg_proc where proname in ('get_space','save_space','sync_ts'); -- prosecdef = true
-- select policyname, cmd from pg_policies where tablename in ('budget_spaces','objects') and policyname like any(array['%code%','budget_couple%']);
