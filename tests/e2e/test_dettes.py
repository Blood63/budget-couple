"""Dettes entre nous : ajout rapide, totaux et solde net, modifier/supprimer avec annulation, rembourser une ligne / tout, archive, cohérence avec l'équilibre du mois, synchro par élément (Supabase simulé), migration v11→v12, axe."""
import subprocess,time,json,os,sys
sys.path.insert(0,os.path.dirname(__file__));from fake_supabase import Fake
from playwright.sync_api import sync_playwright
ROOT=os.path.join(os.path.dirname(__file__),'..','..');OUT=os.environ.get('OUT','/tmp')
srv=subprocess.Popen(['python3','-m','http.server','18765'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
CFG={"url":"https://exemple-fictif.supabase.co","key":"sb_publishable_FICTIF","space":"Exemple-espace-0000"}
D={"version":11,"names":{"p1":"Paul","p2":"Lucie"},"ratio":50,"accounts":[],"incomes":[],"goals":[],"months":[],"placements":[],"transfer":{"amount":0},
 "fixed":[{"id":"f1","label":"Loyer","amount":800,"day":5,"split":50,"paidBy":"p1","category":"logement"}],
 "misc":[{"id":"m1","date":"2026-10-03","label":"Courses","amount":60,"paidBy":"p2","for":"common","payer":"common"}],"settlements":[],"updated":1000}
AX="axe.run(document,{runOnly:['wcag2a','wcag2aa']}).then(r=>r.violations.map(v=>v.id+':'+v.nodes.length))"
errs=[];F=Fake();URLS=[];F.row={'data':D,'updated_at':F.ts()}
def debts(pg):return pg.evaluate("D.debts.map(x=>({...x}))")
try:
 with sync_playwright() as p:
  b=p.chromium.launch()
  def dev(name,who,w=390):
    c=b.new_context(viewport={'width':w,'height':844},locale='fr-FR',timezone_id='Europe/Paris')
    c.add_init_script("sessionStorage.setItem('budget-couple-more','1')");c.add_init_script(f"if(!sessionStorage.s){{localStorage.setItem('budget-couple-cfg',{json.dumps(json.dumps(CFG))});localStorage.setItem('budget-couple-me','{who}');sessionStorage.s=1}}")
    c.route('**/*',lambda r:(URLS.append(r.request.method+' '+r.request.url),F.handle(r,name))[1] if 'supabase.co' in r.request.url else (r.continue_() if r.request.url.startswith('http://localhost:18765') else r.abort()))
    pg=c.new_page();pg.clock.install(time='2026-10-15T17:00:00+02:00');pg.on('pageerror',lambda e:errs.append(name+': '+str(e)))
    pg.on('console',lambda m:m.type=='error' and 'Failed to fetch' not in m.text and 'status of 404' not in m.text and errs.append(name+' '+m.text));pg.on('response',lambda r:r.status==404 and '/rest/v1/rpc/' not in r.url and errs.append(name+' 404 '+r.url))
    pg.goto('http://localhost:18765/');pg.wait_for_function("document.querySelector('#syncState').textContent.includes('✓')");pg.wait_for_timeout(900);pg.add_script_tag(path='/tmp/axe.min.js');return pg
  A=dev('A','p1');B=dev('B','p2')
  d=A.evaluate('D');assert d['version']==13 and d['debts']==[] and d['misc'][0]['amount']==60 and d['fixed'][0]['amount']==800;print('MIGRATION v11→v12 OK')
  bal0=A.evaluate("balance(curMonth()).net")
  # ajout rapide (défaut : l'autre doit à moi)
  assert A.input_value('#fDebtQ [name=from]')=='p2'
  A.fill('#fDebtQ [name=amount]','12,50');A.fill('#fDebtQ [name=label]','Ciné');A.press('#fDebtQ [name=label]','Enter');A.wait_for_timeout(200)
  A.fill('#fDebtQ [name=amount]','8');A.fill('#fDebtQ [name=label]','Pain');A.click('#fDebtQ button');A.wait_for_timeout(200)
  A.select_option('#fDebtQ [name=from]','p1');A.fill('#fDebtQ [name=amount]','5');A.fill('#fDebtQ [name=label]','Café');A.click('#fDebtQ button');A.wait_for_timeout(200)
  A.fill('#fDebtQ [name=amount]','-3');A.click('#fDebtQ button');assert 'positif' in A.inner_text('#debtErr');assert len(debts(A))==3
  assert 'Virement unique pour tout solder' in A.inner_text('.debts') and 'hors équilibre du mois' in A.inner_text('.debts');t=A.inner_text('#debtNet');assert 'Lucie doit 15,50' in t.replace('\u202f',' ').replace('\xa0',' '),t
  assert A.evaluate("debtTotals().owes")=={'p1':5,'p2':20.5}
  # pas de double comptage : l'équilibre du mois est inchangé, la note explique le total tout compris
  assert A.evaluate("balance(curMonth()).net")==bal0;nt=A.inner_text('.bal').replace('\u202f',' ').replace('\xa0',' ');assert 'Hors « Dettes entre nous »' in nt and 'Total tout compris' in nt,nt
  # modifier puis annuler
  cid=[x for x in debts(A) if x['label']=='Ciné'][0]['id']
  A.click(f'[data-debt-edit="{cid}"]');A.wait_for_selector('#fDebt');A.fill('#fDebt [name=amount]','20');A.click('#fDebt button.btn:not([type])');A.wait_for_timeout(200)
  assert [x for x in debts(A) if x['id']==cid][0]['amount']==20;A.click('.toast-undo');A.wait_for_timeout(200);assert [x for x in debts(A) if x['id']==cid][0]['amount']==12.5
  # supprimer puis annuler
  pid=[x for x in debts(A) if x['label']=='Pain'][0]['id'];A.click(f'[data-debt-del="{pid}"]');A.wait_for_timeout(200);assert len(debts(A))==2
  A.click('.toast-undo');A.wait_for_timeout(200);assert len(debts(A))==3
  v=A.evaluate(AX);print('AXE carte',v);assert not v
  A.evaluate("document.querySelector('#toast')?.remove()");A.locator('.debts').scroll_into_view_if_needed();A.wait_for_timeout(300);A.locator('.debts').screenshot(path=f'{OUT}/v11-dettes.png')
  # synchro par élément : B ajoute pendant que A rembourse une ligne
  A.wait_for_timeout(1500);B.evaluate("pullRemote()");B.wait_for_timeout(1200);assert len(debts(B))==3,debts(B)
  B.fill('#fDebtQ [name=amount]','4');B.fill('#fDebtQ [name=label]','Métro');B.click('#fDebtQ button')
  A.click(f'[data-debt-repay="{cid}"]');A.wait_for_timeout(2000)
  for _ in range(2):A.evaluate("pullRemote()");B.evaluate("pullRemote()");A.wait_for_timeout(1500)
  da,db=debts(A),debts(B);assert len(da)==4 and A.evaluate("canon(D)")==B.evaluate("canon(D)"),(da,db)
  assert [x for x in da if x['id']==cid][0]['repaid']=='2026-10-15'
  # tout rembourser, archive consultable, puis annuler
  A.evaluate("go('accueil')");A.wait_for_timeout(300);A.click('#debtRepayAll');A.wait_for_timeout(200)
  assert all(x['repaid'] for x in debts(A)) and 'Personne ne doit rien' in A.inner_text('#debtNet')
  A.click('.toast-undo');A.wait_for_timeout(200);assert sum(1 for x in debts(A) if x['repaid'])==1
  A.click('#debtRepayAll');A.wait_for_timeout(200);A.click('.debt-arch summary');assert 'Remboursées (4)' in A.inner_text('.debt-arch');v=A.evaluate(AX);assert not v,v
  A.evaluate("D.debts.forEach(x=>{if(x.id!=='"+cid+"')x.repaid=null});save()")
  A.evaluate("document.querySelector('.debt-arch').open=true");A.click(f'[data-debt-unrepay="{cid}"]');A.wait_for_timeout(200);assert not any(x['repaid'] for x in debts(A))
  # synchro au repos : seulement updated_at (pas de re-téléchargement du document)
  A.wait_for_timeout(1500);A.evaluate("pullRemote()");A.wait_for_timeout(800);URLS.clear()
  for _ in range(3):A.evaluate("pullRemote()");A.wait_for_timeout(500)
  full=[u for u in URLS if 'select=data' in u];light=[u for u in URLS if 'select=updated_at' in u];print('requêtes au repos',len(light),'légères,',len(full),'complètes');assert light and not full,URLS
  hist=A.evaluate("D.history.filter(h=>h.kind==='debts').length");assert hist>0
  for w in (320,768):
    A.set_viewport_size({'width':w,'height':800});A.wait_for_timeout(200);assert A.evaluate("document.documentElement.scrollWidth<=innerWidth+1"),w
  b.close()
 assert not errs,errs;print('TEST DETTES OK')
finally:srv.kill()
