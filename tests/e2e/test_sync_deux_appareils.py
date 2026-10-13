import subprocess,time,json,sys
sys.path.insert(0,__import__('os').path.dirname(__file__));from fake_supabase import Fake
from playwright.sync_api import sync_playwright
srv=subprocess.Popen(['python3','-m','http.server','18765'],cwd=__import__('os').path.join(__import__('os').path.dirname(__file__),'..','..'),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
errs=[];F=Fake()
CFG={"url":"https://exemple-fictif.supabase.co","key":"sb_publishable_FICTIF","space":"Exemple-espace-0000"}
V3={"version":3,"ratio":50,"fixed":[{"id":"f1","label":"Loyer (exemple)","amount":900,"day":5,"split":50}],"goals":[{"id":"g1","name":"Voyage (exemple)","owner":"common","target":5000,"saved":0}],
    "misc":[{"id":"x1","date":"2026-10-02","label":"Courses (exemple)","amount":50,"payer":"common"}],"updated":1000}
F.row={'data':V3,'updated_at':F.ts()}
with sync_playwright() as p:
  b=p.chromium.launch()
  def dev(name,who):
    c=b.new_context(viewport={'width':390,'height':844})
    c.add_init_script(f"if(!sessionStorage.s){{localStorage.setItem('budget-couple-cfg',{json.dumps(json.dumps(CFG))});localStorage.setItem('budget-couple-me','{who}');sessionStorage.s=1}}")
    c.route('**/*supabase.co/**',lambda r:F.handle(r,name));pg=c.new_page();pg.on('pageerror',lambda e:errs.append(name+': '+str(e)));pg.on("dialog",lambda d:d.accept());pg.on("console",lambda m:print(name,"CONSOLE",m.text[:150]))
    pg.goto('http://localhost:18765/');pg.wait_for_function("document.querySelector('#syncState').textContent.includes('✓')");return pg
  A=dev('A','p1');B=dev('B','p2')
  st=lambda pg:pg.evaluate('JSON.parse(localStorage.getItem("budget-couple-data"))')
  print('migration distante v3→v4 :',st(A)['version'],st(A)['fixed'][0]['paidBy'],st(A)['misc'][0]['for'])
  # Hors ligne en parallèle : modifications concurrentes
  F.offline={'A','B'}
  A.evaluate("D.fixed[0].amount=950;D.misc.push({id:'a1',date:'2026-10-03',label:'Resto A',amount:30,payer:'common'});D.goals[0].target=5200;save()")
  B.evaluate("D.misc=D.misc.filter(x=>x.id!=='x1');D.misc.push({id:'b1',date:'2026-10-04',label:'Ciné B',amount:20,payer:'common'});D.ratio=60;D.goals[0].name='Japon (exemple)';save()")
  A.wait_for_timeout(800);F.offline=set()
  # retour du réseau quasi simultané
  A.evaluate("pullRemote()");B.evaluate("pullRemote()");A.wait_for_timeout(2500)
  A.evaluate("pullRemote()");B.evaluate("pullRemote()");A.wait_for_timeout(1500)
  a,bb,srvd=st(A),st(B),F.row['data']
  ca=A.evaluate("canon(D)");cb=B.evaluate("canon(D)")
  print('A==B',ca==cb,'| écritures',F.writes,'conflits',F.conflicts)
  ids=sorted(x['id'] for x in a['misc'])
  print('misc',ids,'| loyer',a['fixed'][0]['amount'],'| ratio',a['ratio'],'| objectif',a['goals'][0]['name'],a['goals'][0]['target'])
  assert ca==cb and ids==['a1','b1'] and a['fixed'][0]['amount']==950 and a['ratio']==60 and a['goals'][0]['name']=='Japon (exemple)' and a['goals'][0]['target']==5200
  assert sorted(x['id'] for x in srvd['misc'])==['a1','b1']
  print('historique',[(h['by'],h['op'],h['kind'],h['label']) for h in a['history']][:8])
  # écriture en concurrence directe (sans hors ligne)
  A.evaluate("D.misc.push({id:'a2',date:'2026-10-05',label:'A2',amount:1,payer:'p1'});save()");B.evaluate("D.misc.push({id:'b2',date:'2026-10-05',label:'B2',amount:2,payer:'p2'});save()")
  A.wait_for_timeout(2000);A.evaluate("pullRemote()");B.evaluate("pullRemote()");A.wait_for_timeout(1500)
  assert sorted(x['id'] for x in F.row['data']['misc'])==['a1','a2','b1','b2'] and A.evaluate("canon(D)")==B.evaluate("canon(D)");print('CONCURRENCE DIRECTE OK, conflits',F.conflicts)
  b.close()
srv.terminate();print('ERREURS:',errs)
