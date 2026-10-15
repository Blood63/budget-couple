"""Répartition manuelle de la cible des objectifs communs (%, presets, montants fixes), affichage par personne, recalcul de l'historique, migration v10→v11."""
import subprocess,time,json,os
from playwright.sync_api import sync_playwright
ROOT=os.path.join(os.path.dirname(__file__),'..','..');OUT=os.environ.get('OUT','/tmp')
srv=subprocess.Popen(['python3','-m','http.server','18765'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
D={"version":10,"names":{"p1":"Paul","p2":"Lucie"},"ratio":60,"accounts":[],"fixed":[],"incomes":[],"misc":[],"placements":[],"transfer":{"amount":0},
 "goals":[{"id":"g1","name":"Voyage Japon","owner":"common","target":3000,"saved":500,"date":"2027-06"},{"id":"g2","name":"Vélo","owner":"p1","target":800,"date":"2027-01"}],
 "months":[{"id":"m1","month":"2026-07","a":300,"b":200},{"id":"m2","month":"2026-08","a":300,"b":200},{"id":"m3","month":"2026-09","a":250,"b":150,"manual":{"p1":{"g1":100},"p2":{"g1":150}}}]}
AX="axe.run(document,{runOnly:['wcag2a','wcag2aa']}).then(r=>r.violations.map(v=>v.id+':'+v.nodes.length))"
errs=[]
def C(pg):return pg.evaluate("(()=>{const c=compute();return{c:c.contrib,s:c.saved,u:Object.values(c.res).map(r=>[r.p1.unassigned,r.p2.unassigned])}})()")
def total_in(r):return sum(v['p1']+v['p2'] for v in r['c'].values())+sum(a+b for a,b in r['u'])
try:
 with sync_playwright() as p:
  b=p.chromium.launch();c=b.new_context(viewport={'width':390,'height':844},locale='fr-FR',timezone_id='Europe/Paris')
  c.add_init_script(f"if(!sessionStorage.s){{localStorage.setItem('budget-couple-data',{json.dumps(json.dumps(D))});localStorage.setItem('budget-couple-me','p1');sessionStorage.s=1}}")
  pg=c.new_page();pg.clock.install(time='2026-10-14T10:00:00+02:00');pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:m.type=='error' and errs.append(m.text))
  pg.goto('http://localhost:18765/');pg.wait_for_function('RATES!==null');pg.wait_for_timeout(400);pg.add_script_tag(path='/tmp/axe.min.js')
  d=pg.evaluate('D');assert d['version']==12 and d['goals'][0]['split'] is None and len(d['months'])==3 and d['months'][2]['manual']['p2']['g1']==150;print('MIGRATION v10→v11 OK')
  r0=C(pg);IN=1400
  assert abs(total_in(r0)-IN)<0.02,r0
  # défaut = réglages 60/40 : part Paul 1800 (dont 300 initial), Lucie 1200 (dont 200 initial)
  P=pg.evaluate("goalPersons(D.goals[0],compute(),'2026-10')");assert P[0]['target']==1800 and P[1]['target']==1200,P
  assert abs(P[0]['paid']-(300+r0['c']['g1']['p1']))<0.01 and abs(P[1]['paid']-(200+r0['c']['g1']['p2']))<0.01
  # Lucie n'a que g1 : tout son versement auto va à g1 (dans la limite de sa part)
  assert abs(r0['c']['g1']['p2']-550)<0.01,r0
  # formulaire : % via preset 70/30
  pg.evaluate("go('objectifs')");pg.wait_for_timeout(900);pg.click('[data-edit-goal="g1"]');pg.wait_for_selector('#gSplit')
  assert pg.is_checked('[name=smode][value=auto]')
  pg.click('.seg-o:has([value=pct])');pg.click('[data-spreset="70"]');assert '2 100,00' in pg.inner_text('#sSum').replace('\u202f',' ')
  v=pg.evaluate(AX);print('AXE formulaire',v);assert not v
  pg.locator('#gSplit').scroll_into_view_if_needed();pg.wait_for_timeout(700);pg.screenshot(path=f'{OUT}/v10-objectif-repartition-form.png')
  pg.click('#fGoal button.btn:not([type])');pg.wait_for_timeout(300);assert pg.evaluate("D.goals[0].split")=={'mode':'pct','p1':70}
  r1=C(pg);assert abs(total_in(r1)-IN)<0.02;P=pg.evaluate("goalPersons(D.goals[0],compute(),'2026-10')");assert P[0]['target']==2100 and P[1]['target']==900
  # montants fixes : validation de la somme
  pg.click('[data-edit-goal="g1"]');pg.wait_for_selector('#gSplit');pg.click('.seg-o:has([value=amount])')
  pg.fill('[name=sa1]','400');pg.fill('[name=sa2]','2000');assert 'doit égaler' in pg.inner_text('#sSum')
  pg.click('#fGoal button.btn:not([type])');assert 'doit être égale à la cible' in pg.inner_text('#goalErr');assert pg.evaluate("D.goals[0].split.mode")=='pct'
  pg.fill('[name=sa2]','2600');pg.click('#fGoal button.btn:not([type])');pg.wait_for_timeout(300)
  assert pg.evaluate("D.goals[0].split")=={'mode':'amount','p1':400,'p2':2600}
  # recalcul de l'historique : Paul plafonné à sa part (400 - initial 66,67), le surplus va au vélo ou reste non affecté ; manuel conservé
  r2=C(pg);assert abs(total_in(r2)-IN)<0.02,r2
  P=pg.evaluate("goalPersons(D.goals[0],compute(),'2026-10')");assert P[0]['target']==400 and P[0]['paid']<=400.01 and P[0]['rest']>=0,P
  assert r2['c']['g2']['p1']>r0['c']['g2']['p1'],(r0,r2)
  m3=pg.evaluate("compute().res.m3");assert m3['p2']['alloc']['g1']==150 and m3['p1']['manual']
  t=pg.inner_text('[data-edit-goal="g1"]');assert 'montants fixes' in t and '/mois' in t and 'reste' in t,t
  v=pg.evaluate(AX);print('AXE liste',v);assert not v
  pg.evaluate("document.querySelector('#toast')?.remove()");pg.locator('[data-edit-goal="g1"]').scroll_into_view_if_needed();pg.wait_for_timeout(300);pg.screenshot(path=f'{OUT}/v10-objectif-repartition.png')
  # retour aux réglages
  pg.click('[data-edit-goal="g1"]');pg.click('.seg-o:has([value=auto])');pg.click('#fGoal button.btn:not([type])');pg.wait_for_timeout(200)
  assert pg.evaluate("D.goals[0].split") is None and C(pg)==r0
  # cible modifiée en mode montants : refusée si la somme ne suit pas
  for w in (320,768):
    pg.set_viewport_size({'width':w,'height':800});pg.wait_for_timeout(200);assert pg.evaluate("document.documentElement.scrollWidth<=innerWidth+1"),w
  pg.reload();pg.wait_for_function('RATES!==null');assert pg.evaluate("D.goals[0].split") is None
  b.close()
 assert not errs,errs;print('TEST RÉPARTITION OK')
finally:srv.kill()
