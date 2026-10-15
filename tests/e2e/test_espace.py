"""Espace utilisé (Réglages) et secours IndexedDB quand localStorage est plein : aucune donnée perdue, rechargement fidèle."""
import subprocess,time,json,os
from playwright.sync_api import sync_playwright
ROOT=os.path.join(os.path.dirname(__file__),'..','..')
srv=subprocess.Popen(['python3','-m','http.server','18766'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
D={"version":12,"names":{"p1":"Paul","p2":"Lucie"},"ratio":50,"misc":[],"fixed":[],"goals":[],"months":[],"incomes":[],"accounts":[],"placements":[],"transfer":{"amount":0},"updated":1000,
   "insurances":[{"id":"i1","type":"habitation","label":"Habitation","doc":{"name":"contrat.pdf","size":2400000,"storage":"supabase"}}]}
errs=[]
try:
 with sync_playwright() as p:
  b=p.chromium.launch();c=b.new_context(viewport={'width':390,'height':844})
  c.add_init_script(f"if(!sessionStorage.s){{localStorage.setItem('budget-couple-data',{json.dumps(json.dumps(D))});localStorage.setItem('budget-couple-me','p1');sessionStorage.s=1}}")
  c.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://localhost:18766') else r.abort())
  pg=c.new_page();pg.on('pageerror',lambda e:errs.append(str(e)))
  pg.goto('http://localhost:18766/');pg.wait_for_timeout(600)
  pg.evaluate("go('reglages')");pg.wait_for_timeout(300);t=pg.inner_text('#spaceCard');assert 'Stockage local' in t and '2,29 Mo' in t and '500 Mo' in t;print('carte OK')
  n=pg.evaluate("""(()=>{const lab='CB CARREFOUR MARKET PARIS 15 ACHAT DU 12/03 '.repeat(3);for(let i=0;i<40000;i++)D.misc.push({id:'z'+i,date:'2026-0'+(1+i%9)+'-1'+(i%9),label:lab+i,amount:i%500+.5,category:'courses',paidBy:'joint',for:'common'});
    D.updated=Date.now();const j=JSON.stringify(D);persistSafe(j);SNAP=snapshot(D);return j.length})()""")
  print('taille JSON',n);assert n>5.3e6
  pg.wait_for_function("!!localStorage.getItem('budget-couple-data-idb')",timeout=10000)
  pg.evaluate("render()");pg.wait_for_timeout(400);t=pg.inner_text('#spaceCard');assert 'IndexedDB' in t and '9,58 Mo' in t,t;print('indicateur IDB OK')
  pg.reload();pg.wait_for_function("D.misc.length===40000",timeout=20000);print('rechargement IndexedDB OK')
  # sous le quota : localStorage reprend la main
  r=pg.evaluate("D.misc=D.misc.slice(0,10);D.updated=Date.now();const ok=persistSafe(JSON.stringify(D));SNAP=snapshot(D);[ok,!!localStorage.getItem('budget-couple-data-idb')]")
  assert r[0] and not r[1],r;pg.reload();pg.wait_for_timeout(1200);assert pg.evaluate("D.misc.length")==10
  b.close()
 assert not errs,errs;print('TEST ESPACE OK')
finally:srv.kill()
