import json,threading,urllib.parse
class Fake:
  """Faux PostgREST : une table budget_spaces en mémoire, avec écriture conditionnelle."""
  def __init__(s,row=None):s.row=row;s.n=0;s.offline=set();s.writes=0;s.conflicts=0
  def ts(s):s.n+=1;return f"2026-10-13T12:00:{s.n:02d}.000000+00:00"
  def handle(s,route,dev):
    r=route.request;H={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','content-type':'application/json'}
    if r.method=='OPTIONS':return route.fulfill(status=204,headers=H)
    if dev in s.offline:return route.abort('internetdisconnected')
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
