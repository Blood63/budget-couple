import json,threading,urllib.parse
class Fake:
  """Faux PostgREST : une table budget_spaces en mémoire, avec écriture conditionnelle."""
  def __init__(s,row=None,secure=False):
    s.rows={};s.main=None;s.row=row;s.n=0;s.offline=set();s.writes=0;s.conflicts=0;s.objects={};s.bucket=True;s.policies=True
    s.secure=secure;s.rpc_calls=0;s.table_calls=0  # secure=True : comme après supabase/secure.sql (table fermée, RPC seulement)
  # s.row = ligne de l'espace principal (premier code vu) ; les autres codes ont leur propre ligne dans s.rows
  @property
  def row(s):return s.rows.get('__main__')
  @row.setter
  def row(s,v):
    if v is None:s.rows.pop('__main__',None)
    else:s.rows['__main__']=v
  def key(s,code):
    if s.main is None:s.main=code
    return '__main__' if code==s.main else code
  def ts(s):s.n+=1;return f"2026-10-13T12:00:{s.n:02d}.000000+00:00"
  def handle(s,route,dev):
    r=route.request;H={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','content-type':'application/json'}
    if r.method=='OPTIONS':return route.fulfill(status=204,headers=H)
    if dev in s.offline:return route.abort('internetdisconnected')
    path=urllib.parse.urlparse(r.url).path
    if '/storage/v1/object' in path:return s.storage(route,r,path,H)
    q=urllib.parse.parse_qs(urllib.parse.urlparse(r.url).query)
    if '/rest/v1/rpc/' in path:return s.rpc(route,r,path.rsplit('/',1)[1],H)
    s.table_calls+=1
    if s.secure:return route.fulfill(status=401,headers=H,body='{"code":"42501","message":"permission denied for table budget_spaces"}')
    code=q.get('code',[''])[0].replace('eq.','',1)
    if r.method=='GET':
      k=s.key(code);return route.fulfill(status=200,headers=H,body=json.dumps([s.rows[k]] if k in s.rows else []))
    body=json.loads(r.post_data or '{}')
    if r.method=='POST':
      k=s.key(body.get('code',''))
      if k in s.rows:return route.fulfill(status=409,headers=H,body='{"code":"23505"}')
      s.rows[k]={'data':body['data'],'updated_at':s.ts()};s.writes+=1;return route.fulfill(status=201,headers=H,body='')
    if r.method=='PATCH':
      k=s.key(code);want=q.get('updated_at',[''])[0].replace('eq.','',1)
      if k not in s.rows or s.rows[k]['updated_at']!=want:s.conflicts+=1;return route.fulfill(status=200,headers=H,body='[]')
      s.rows[k]={'data':body['data'],'updated_at':s.ts()};s.writes+=1;return route.fulfill(status=200,headers=H,body=json.dumps([s.rows[k]]))
    route.fulfill(status=405,headers=H,body='{}')

  def rpc(s,route,r,fn,H):
    """Fonctions de supabase/secure.sql (get_space, sync_ts, save_space) : 404 PGRST202 si le script n'est pas installé."""
    if not s.secure:return route.fulfill(status=404,headers=H,body='{"code":"PGRST202","message":"Could not find the function public.%s"}'%fn)
    s.rpc_calls+=1;a=json.loads(r.post_data or '{}');code=a.get('p_code','')
    if len(code)<8:
      if fn=='save_space':return route.fulfill(status=400,headers=H,body='{"code":"23514","message":"code trop court"}')
      return route.fulfill(status=200,headers=H,body='null')
    k=s.key(code);row=s.rows.get(k)
    if fn=='get_space':return route.fulfill(status=200,headers=H,body=json.dumps(row))
    if fn=='sync_ts':return route.fulfill(status=200,headers=H,body=json.dumps(row and row['updated_at']))
    if fn=='save_space':
      exp=a.get('p_expected')
      if (exp is None and row) or (exp is not None and (not row or row['updated_at']!=exp)):
        s.conflicts+=1;return route.fulfill(status=200,headers=H,body=json.dumps({'ok':False,'updated_at':row and row['updated_at']}))
      s.rows[k]={'data':a['p_data'],'updated_at':s.ts()};s.writes+=1
      return route.fulfill(status=200,headers=H,body=json.dumps({'ok':True,'updated_at':s.rows[k]['updated_at']}))
    route.fulfill(status=404,headers=H,body='{"code":"PGRST202"}')

  def storage(s,route,r,path,H):
    """Faux Supabase Storage : bucket privé « documents »."""
    if r.headers.get('apikey','')=='' :return route.fulfill(status=401,headers=H,body='{"message":"Unauthorized"}')
    if not s.bucket:return route.fulfill(status=400,headers=H,body='{"statusCode":"404","error":"Bucket not found","message":"Bucket not found"}')
    if not s.policies and r.method!='GET':return route.fulfill(status=400,headers=H,body='{"statusCode":"403","error":"Unauthorized","message":"new row violates row-level security policy"}')
    if r.method=='POST' and path.startswith('/storage/v1/object/documents/'):
      k=path[len('/storage/v1/object/documents/'):];s.objects[k]=(r.post_data_buffer,r.headers.get('content-type'));return route.fulfill(status=200,headers=H,body=json.dumps({'Key':'documents/'+k}))
    if r.method=='GET' and path.startswith('/storage/v1/object/authenticated/documents/'):
      k=path[len('/storage/v1/object/authenticated/documents/'):]
      if k not in s.objects:return route.fulfill(status=400,headers=H,body='{"message":"Object not found"}')
      b,ct=s.objects[k];return route.fulfill(status=200,headers={**H,'content-type':ct},body=b)
    if r.method=='DELETE' and path.rstrip('/')=='/storage/v1/object/documents':
      for k in json.loads(r.post_data or '{}').get('prefixes',[]):s.objects.pop(k,None)
      return route.fulfill(status=200,headers=H,body='[]')
    route.fulfill(status=405,headers=H,body='{}')
