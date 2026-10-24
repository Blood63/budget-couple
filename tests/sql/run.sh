#!/bin/bash
# Test réel du SQL sur un Postgres local jetable (données fictives).
set -e; D=$(mktemp -d); B=/usr/lib/postgresql/17/bin; S="$(cd "$(dirname "$0")/../.." && pwd)"
$B/initdb -D $D -A trust -U postgres >/dev/null; $B/pg_ctl -D $D -o "-k $D -p 55432 -c listen_addresses=''" -l $D/log start >/dev/null
trap "$B/pg_ctl -D $D stop -m fast >/dev/null; rm -rf $D" EXIT
P="psql -X -q -v ON_ERROR_STOP=1 -h $D -p 55432 -U postgres postgres"
$P -f $S/tests/sql/mock_supabase.sql; $P -f $S/supabase/schema.sql; $P -f $S/supabase/storage.sql
$P -c "insert into budget_spaces values ('Fictif-espace-0001','{\"names\":{\"p1\":\"Alice\"}}','2026-01-01T00:00:00Z'),('Fictif-espace-0002','{\"x\":1}',now());
 insert into storage.objects(bucket_id,name) values ('documents','0123456789abcdef0123456789abcdef/ins1/a.pdf'),('documents','fedcba9876543210fedcba9876543210/ins2/b.pdf');"
echo "--- AVANT secure.sql (faille) ---"
$P -c "set role anon; select count(*) as espaces_listables from budget_spaces; select count(*) as fichiers_listables from storage.objects;"
$P -f $S/supabase/secure.sql; $P -f $S/supabase/secure.sql   # idempotent
$P -f $S/tests/sql/assert_secure.sql
echo "SQL OK"
