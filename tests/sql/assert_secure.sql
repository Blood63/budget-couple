\set ON_ERROR_STOP 1
do $$ declare n int; r jsonb; t timestamptz; begin
  select count(*) into n from budget_spaces; assert n=2, 'lignes conservées';
  select count(*) into n from storage.objects; assert n=2, 'fichiers conservés';
  assert (select data->'names'->>'p1' from budget_spaces where code='Fictif-espace-0001')='Alice', 'données intactes';
  assert not has_table_privilege('anon','public.budget_spaces','select'), 'anon select révoqué';
  assert not has_table_privilege('anon','public.budget_spaces','update'), 'anon update révoqué';
end $$;
set role anon;
do $$ declare ok boolean:=false; begin begin perform * from budget_spaces; exception when insufficient_privilege then ok:=true; end; assert ok,'listing table refusé'; end $$;
do $$ declare ok boolean:=false; begin begin update budget_spaces set data='{}'; exception when insufficient_privilege then ok:=true; end; assert ok,'update direct refusé'; end $$;
do $$ declare r jsonb; t timestamptz; r2 jsonb; n int; begin
  assert get_space('inconnu-xxxxxxxx') is null, 'code inconnu → null';
  assert get_space('court') is null, 'code court → null';
  r:=get_space('Fictif-espace-0001'); assert r->'data'->'names'->>'p1'='Alice','lecture RPC';
  t:=(r->>'updated_at')::timestamptz; assert sync_ts('Fictif-espace-0001')=t,'sync_ts';
  r2:=save_space('Fictif-espace-0001','{"v":2}','2020-01-01Z'); assert not (r2->>'ok')::boolean,'conflit détecté';
  assert (r2->>'updated_at')::timestamptz=t,'conflit renvoie ts actuel';
  r2:=save_space('Fictif-espace-0001','{"v":2}',t); assert (r2->>'ok')::boolean,'écriture avec bon ts';
  assert (r2->>'updated_at')::timestamptz>t,'ts avancé';
  r2:=save_space('Fictif-espace-0001','{"v":3}',t); assert not (r2->>'ok')::boolean,'ancien ts refusé';
  r2:=save_space('Fictif-espace-0001','{"v":3}',null); assert not (r2->>'ok')::boolean,'création sur existant refusée';
  r2:=save_space('Nouveau-espace-fictif-01','{"a":1}',null); assert (r2->>'ok')::boolean,'création';
  begin perform save_space('court','{}',null); assert false; exception when check_violation then null; end;
  begin perform save_space('Nouveau-espace-fictif-01','[1]',null); assert false; exception when invalid_parameter_value then null; end;
  -- Storage
  select count(*) into n from storage.objects; assert n=0,'listing sans opération : 0';
  perform set_config('storage.operation','storage.object.list',true); select count(*) into n from storage.objects; assert n=0,'list refusé';
  perform set_config('storage.operation','storage.object.list_v2',true); select count(*) into n from storage.objects; assert n=0,'list_v2 refusé';
  perform set_config('storage.operation','storage.object.get_authenticated',true);
  select count(*) into n from storage.objects where name='0123456789abcdef0123456789abcdef/ins1/a.pdf'; assert n=1,'lecture chemin connu';
  perform set_config('storage.operation','storage.object.list',true);
  delete from storage.objects; get diagnostics n=row_count; assert n=0,'suppression massive refusée';
  perform set_config('storage.operation','storage.object.delete_many',true);
  delete from storage.objects where name='fedcba9876543210fedcba9876543210/ins2/b.pdf'; get diagnostics n=row_count; assert n=1,'suppression chemin connu';
  insert into storage.objects(bucket_id,name) values('documents','fedcba9876543210fedcba9876543210/ins2/b.pdf');
  begin insert into storage.objects(bucket_id,name) values('documents','pasunhash/x.pdf'); assert false; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin assert (select count(*) from budget_spaces)=3; assert (select count(*) from storage.objects)=2; end $$;
