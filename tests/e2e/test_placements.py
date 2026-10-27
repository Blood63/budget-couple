"""Playwright : migration v5→v6 (lignes → valorisation), enveloppes, rappel mensuel, validations, retour Android."""
import subprocess,time,json,os
from playwright.sync_api import sync_playwright
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..');OUT=os.environ.get('SHOTS','/tmp')
srv=subprocess.Popen(['python3','-m','http.server','18765'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
errs=[]
V5={"version":5,"updated":50,"ratio":50,
 "placements":[{"id":"av","type":"av","name":"Assurance vie (exemple)","bank":"Assureur Exemple","owner":"common","capital":0,"monthly":20,"rate":0,"rateMode":"manual","u":1,"c":0},
   {"id":"pea","type":"pea","name":"PEA (exemple)","bank":"Banque Exemple","owner":"p1","capital":4200,"monthly":100,"rate":5,"rateMode":"manual","u":1,"c":1},
   {"id":"la","type":"livretA","name":"Livret A (exemple)","bank":"Banque Exemple","owner":"p2","capital":6000,"monthly":50,"rate":1.7,"rateMode":"auto","u":1,"c":2}],
 "positions":[{"id":"x1","pid":"av","kind":"euro","name":"Fonds euros","invested":10000,"value":10450,"rate":2.5,"monthly":100,"priceDate":"2026-09-20","u":1},
   {"id":"x2","pid":"av","kind":"etf","name":"ETF Monde","isin":"IE00B4L5Y983","qty":40,"pru":80,"price":95.5,"rate":6,"monthly":150,"priceDate":"2026-09-20","u":1},
   {"id":"x3","pid":"av","kind":"action","name":"Action","isin":"FR0000120271","qty":10,"pru":60,"price":55,"rate":4,"monthly":0,"priceDate":"2026-09-20","u":1}],
 "goals":[{"id":"g1","name":"Voyage (exemple)","owner":"common","target":3000,"saved":3000,"date":"2027-06"},{"id":"g2","name":"Cadeau (exemple)","owner":"p2","target":500,"saved":100,"date":"2026-06"}]}
with sync_playwright() as p:
  b=p.chromium.launch();c=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True,locale='fr-FR')
  c.add_init_script(f"if(!sessionStorage.s){{localStorage.setItem('budget-couple-data',{json.dumps(json.dumps(V5))});localStorage.setItem('budget-couple-me','p1');sessionStorage.s=1}}")
  pg=c.new_page();pg.clock.install(time='2026-10-10T10:00:00+02:00');pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:m.type=='error' and errs.append(m.text));pg.on('dialog',lambda d:d.accept())
  pg.goto('http://localhost:18765/');pg.wait_for_function('RATES!==null');pg.wait_for_timeout(300)
  d=pg.evaluate('D');av=[x for x in d['placements'] if x['id']=='av'][0]
  assert d['version']==14 and d['positions']==[] and len(d['archive']['positions'])==3 and av['capital']==14820 and av['invested']==13800 and av['monthly']==270 and len(av['archivedLines'])==3
  assert pg.evaluate("placValue(D.placements.find(p=>p.id==='av'))")==14820;print('MIGRATION v5→v6 OK : 14 820 € conservés, détail archivé')
  # rappel : AV (valorisée le 20/09) et PEA (jamais) sont dus au 1er octobre
  due=pg.evaluate("dueValuations().map(p=>p.id)");assert sorted(due)==['av','pea'],due
  assert pg.inner_text('#tab-placements .tab-badge')=='2';print('RAPPEL + BADGE OK',due)
  pg.wait_for_timeout(900);pg.screenshot(path=f'{OUT}/v4-1-accueil-rappel.png')
  # saisie rapide depuis l'accueil
  pg.fill('form.qval[data-pid=pea] [name=value]','abc');pg.click('form.qval[data-pid=pea] .btn');assert pg.evaluate("D.valuations.filter(v=>v.pid==='pea').length")==0;print('VALIDATION montant invalide OK')
  pg.fill('form.qval[data-pid=pea] [name=value]','4 380,50');pg.click('form.qval[data-pid=pea] .btn');pg.wait_for_timeout(300)
  assert pg.evaluate("lastVal('pea').value")==4380.5 and pg.inner_text('#tab-placements .tab-badge')=='1';print('SAISIE RAPIDE OK')
  # jour du rappel configurable : le 15 → l'AV valorisée le 20/09 n'est plus due
  pg.click('#gear');pg.fill('#fNames [name=reminderDay]','15');pg.click('#fNames .btn');pg.wait_for_timeout(300)
  assert pg.evaluate("dueValuations().length")==0 and pg.is_hidden('#tab-placements .tab-badge');pg.screenshot(path=f'{OUT}/v4-4-reglages-rappel.png')
  pg.fill('#fNames [name=reminderDay]','1');pg.click('#fNames .btn');pg.wait_for_timeout(300);print('JOUR DE RAPPEL OK')
  # enveloppe : historique + graphique + plus-value
  pg.click('[data-tab=placements]');pg.wait_for_timeout(1200);pg.screenshot(path=f'{OUT}/v4-2-placements.png')
  pg.click('[data-edit-plac=av]');pg.wait_for_timeout(300)
  for dt,v in [('2026-06-30','13900'),('2026-07-31','14150'),('2026-08-31','14390')]:
    pg.fill('#fVal [name=date]',dt);pg.fill('#fVal [name=value]',v);pg.click('#fVal .btn');pg.wait_for_timeout(250)
  pg.fill('#fVal [name=value]','15 020');pg.click('#fVal .btn');pg.wait_for_timeout(300)
  assert pg.evaluate("placValue(D.placements.find(p=>p.id==='av'))")==15020 and pg.evaluate("valsOf('av').length")==5
  g=pg.evaluate("gain(D.placements.find(p=>p.id==='av'))");assert abs(g['d']-1220)<.01;print('ENVELOPPE : valorisation 15 020 €, plus-value',g['d'])
  assert pg.locator('#sheetBody [data-chart]').count()==1 and pg.locator('#sheetBody details.ichart-data').count()==1
  pg.screenshot(path=f'{OUT}/v4-3-enveloppe.png');pg.evaluate("document.querySelector('#sheetBody .valform').scrollIntoView({block:'start'})");pg.wait_for_timeout(200);pg.screenshot(path=f'{OUT}/v4-3b-enveloppe-historique.png')
  # validation du formulaire de placement
  pg.evaluate("document.querySelector('#fPlac').scrollIntoView()");pg.fill('#fPlac [name=invested]','-5');pg.click('#fPlac .btn:not(.danger)');pg.wait_for_timeout(200)
  assert pg.evaluate("D.placements.find(p=>p.id==='av').invested")==13800;pg.fill('#fPlac [name=invested]','13800');print('VALIDATION négatif OK')
  # retour Android ferme la feuille
  pg.go_back();pg.wait_for_timeout(400);assert pg.is_hidden('#sheet');print('RETOUR ferme la feuille OK')
  # projection : calcul indépendant
  proj=pg.evaluate("project(streams())[48].total")
  def fv(c,m,r):
    v=c
    for _ in range(48):v=v*(1+r/100/12)+m
    return v
  rav=round((10450*2.5+3820*6+550*4)/14820,2)
  exp=fv(15020,270,rav)+fv(4380.5,100,5)+fv(6000,50,1.7);assert abs(proj-exp)<0.01,(proj,exp);print('PROJECTION OK',round(proj,2))
  # nouvelle enveloppe : valorisation initiale = premier point d'historique
  pg.click('#addPlac');pg.select_option('#ptype','cto');pg.wait_for_timeout(150);pg.fill('#fPlac [name=name]','Compte-titres (exemple)');pg.fill('#fPlac [name=bank]','Banque Exemple');pg.fill('#fPlac [name=capital]','2500');pg.fill('#fPlac [name=invested]','2300');pg.fill('#fPlac [name=rate]','5');pg.click('#fPlac .btn:not(.danger)');pg.wait_for_timeout(300)
  cid=pg.evaluate("D.placements.find(p=>p.type==='cto').id");assert pg.evaluate(f"lastVal('{cid}').value")==2500 and pg.evaluate("dueValuations().length")==0;print('NOUVELLE ENVELOPPE OK')
  pg.keyboard.press('Escape');pg.wait_for_timeout(300)
  # objectifs : atteint / échéance dépassée
  pg.click('[data-tab=objectifs]');pg.wait_for_timeout(1100);t=pg.inner_text('#view');assert 'Objectif atteint' in t and 'Échéance dépassée' in t;pg.screenshot(path=f'{OUT}/v4-5-objectifs.png');print('OBJECTIFS états OK')
  pg.add_script_tag(url='https://cdn.jsdelivr.net/npm/axe-core@4/axe.min.js') if not os.path.exists('/tmp/axe.min.js') else pg.add_script_tag(path='/tmp/axe.min.js')
  for t in ['accueil','placements']:
    pg.click(f'[data-tab={t}]');pg.wait_for_timeout(1000);print('AXE',t,pg.evaluate("axe.run(document,{runOnly:['wcag2a','wcag2aa']}).then(r=>r.violations.map(v=>v.id+':'+v.nodes.length))"))
  # accueil vide : guide de démarrage
  c2=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,locale='fr-FR');c2.add_init_script("localStorage.setItem('budget-couple-me','p2')")
  q=c2.new_page();q.on('pageerror',lambda e:errs.append(str(e)));q.goto('http://localhost:18765/');q.wait_for_timeout(1000);assert 'Pour bien démarrer' in q.inner_text('#view');q.screenshot(path=f'{OUT}/v4-6-accueil-vide.png');print('ONBOARDING OK')
  b.close()
srv.terminate();print('ERREURS:',errs);assert not errs
