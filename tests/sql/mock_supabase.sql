-- Imitation minimale de Supabase pour tester les scripts SQL en local (jamais le vrai projet).
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated; -- comme Supabase
create schema if not exists storage; grant usage on schema storage to anon, authenticated;
create table if not exists storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects(id serial primary key, bucket_id text, name text);
alter table storage.objects enable row level security;
grant all on storage.objects to anon, authenticated; grant usage on sequence storage.objects_id_seq to anon;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
