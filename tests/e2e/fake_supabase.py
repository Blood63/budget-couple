import json,threading,urllib.parse
class Fake:
  """Faux PostgREST : une table budget_spaces en mémoire, avec écriture conditionnelle."""
  def __init__(s,row=None):s.row=row;s.n=0;s.offline=set();s.writes=0;s.conflicts=0;s.objects={};s.bucket=True;s.policies=True
  def ts(s):s.n+=1;return f"2026-10-13T12:00:{s.n:02d}.000000+00:00"
  def handle(s,route,dev):
    r=route.request;H={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','content-type':'application/json'}
    if r.method=='OPTIONS':return route.fulfill(status=204,headers=H)
    if dev in s.offline:return route.abort('internetdisconnected')
    path=urllib.parse.urlparse(r.url).path
    if '/storage/v1/object' in path:return s.storage(route,r,path,H)
    q=urllib.parse.parse_qs(urllib.parse.urlparse(r.url).query)
    if True:
      if r.method=='GET':return route.fulfill(status=200,headers=H,body=json.dumps([s.row] if s.row else []))
      body=json.loads(r.post_data or '{}')
      if r.method=='POST':
        if s.row:return route.fulfill(status=409,headers=H,body='{"code":"23505"}')
        s.row={'data':body['data'],'updated_at':s.ts()};s.writes+=1;return route.fulfill(status=201,headers=H,body='')
      if r.method=='PATCH':
        want=q.get('updated_at',[''])[0].replace('eq.','',1)
        if not s.row or s.row['updated_at']!=want:s.conflicts+=1;return route.fulfill(status=200,headers=H,body='[]')
        s.row={'data':body['data'],'updated_at':s.ts()};s.writes+=1;return route.fulfill(status=200,headers=H,body=json.dumps([s.row]))
    route.fulfill(status=405,headers=H,body='{}')

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
