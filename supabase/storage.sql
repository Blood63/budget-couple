-- Budget couple v7 : stockage privé des documents d'assurance (bucket « documents »)
-- À exécuter UNE fois dans Supabase > SQL Editor (projet déjà configuré avec schema.sql).
-- Le bucket est PRIVÉ : aucun lien public ; les fichiers ne se lisent qu'avec la clé de l'appli.
-- Chemins : <empreinte SHA-256 du code d'espace (32 caractères hex)>/<id assurance>/<fichier>
-- Limite : même modèle de sécurité que la table (clé publishable + code d'espace) ; quiconque
-- possède la clé ET l'empreinte de votre code peut lire les documents. Gardez le code secret.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760,
        array['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "budget_couple_docs_select" on storage.objects;
drop policy if exists "budget_couple_docs_insert" on storage.objects;
drop policy if exists "budget_couple_docs_update" on storage.objects;
drop policy if exists "budget_couple_docs_delete" on storage.objects;

create policy "budget_couple_docs_select" on storage.objects for select to anon
  using (bucket_id = 'documents');
create policy "budget_couple_docs_insert" on storage.objects for insert to anon
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] ~ '^[0-9a-f]{32}$');
create policy "budget_couple_docs_update" on storage.objects for update to anon
  using (bucket_id = 'documents')
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] ~ '^[0-9a-f]{32}$');
create policy "budget_couple_docs_delete" on storage.objects for delete to anon
  using (bucket_id = 'documents');

-- Vérification (lecture seule) :
-- select id, public, file_size_limit from storage.buckets where id = 'documents';
