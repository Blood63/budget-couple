"""Comptes, intérêts (livret par quinzaines, fonds euros), bilans mensuels ; horloge fixée au 3 janvier 2027. Données fictives."""
import subprocess,time,json,os
from playwright.sync_api import sync_playwright
ROOT=os.path.join(os.path.dirname(__file__),'..','..');OUT=os.environ.get('OUT','/tmp')
srv=subprocess.Popen(['python3','-m','http.server','18765'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
D={"version":7,"names":{"p1":"Paul","p2":"Lucie"},"ratio":55,
 "incomes":[{"id":"i1","person":"p1","type":"salaire","label":"Salaire","amount":2400,"recurring":True},{"id":"i2","person":"p2","type":"salaire","label":"Salaire","amount":2100,"recurring":True}],
 "fixed":[{"id":"f1","label":"Loyer","amount":950,"day":5,"split":55,"category":"logement","paidBy":"joint"},{"id":"f2","label":"Box internet","amount":30,"day":12,"split":55,"category":"abonnement","paidBy":"p1"}],
 "months":[{"id":"m1","month":"2026-11","a":300,"b":250},{"id":"m2","month":"2026-12","a":350,"b":200}],
 "goals":[{"id":"g1","name":"Voyage","target":3000,"owner":"common","saved":400}],
 "misc":[{"id":"x1","date":"2026-12-12","label":"Courses","amount":120,"category":"courses","payer":"p1","for":"common"}],
 "placements":[{"id":"pl1","type":"livretA","name":"Livret A Lucie","owner":"p2","capital":8000,"monthly":100,"payDay":1,"rateMode":"auto","capitalDate":"2026-03-01"},
   {"id":"pl2","type":"av","name":"Assurance vie (exemple)","owner":"p1","invested":10000,"monthly":0,"rate":3,"euroMode":"pct","euroValue":60}],
 "valuations":[{"id":"v1","pid":"pl2","date":"2026-11-30","value":10500}],"transfer":{"amount":0},"budget":{},"history":[{"id":"h0","t":1767225600000,"by":"p1","op":"add","kind":"fixed","label":"Loyer"}]}
AX="axe.run(document,{runOnly:['wcag2a','wcag2aa']}).then(r=>r.violations.map(v=>v.id+':'+v.nodes.length))"
errs=[]
try:
 with sync_playwright() as p:
  b=p.chromium.launch()
  def page(w):
    c=b.new_context(viewport={'width':w,'height':844},locale='fr-FR',timezone_id='Europe/Paris')
    c.add_init_script(f"if(!sessionStorage.s){{localStorage.setItem('budget-couple-data',{json.dumps(json.dumps(D))});localStorage.setItem('budget-couple-me','p1');sessionStorage.s=1}}")
    pg=c.new_page();pg.clock.install(time='2027-01-03T10:00:00+01:00');pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:m.type=='error' and errs.append(m.text))
    pg.goto('http://localhost:18765/');pg.wait_for_function('RATES!==null');pg.wait_for_timeout(600);return pg
  pg=page(390);d=pg.evaluate('D')
  assert d['version']==9 and [r['id'] for r in d['reports']]==['rep-2026-12'],d['reports'];r=d['reports'][0]
  assert r['savings']=={'p1':350,'p2':200} and r['prevSavings']==550 and r['misc']==120 and r['goals'][0]['saved']==400+300+250+350+200,r
  t=pg.inner_text('#view');assert 'Bilan de décembre 2026' in t and 'Intérêts 2026 à valider' in t;print('BILAN + CARTE INTÉRÊTS OK')
  pg.add_script_tag(path='/tmp/axe.min.js');v=pg.evaluate(AX);print('AXE accueil',v);assert not v
  pg.wait_for_timeout(800);pg.screenshot(path=f'{OUT}/v7-1-accueil-janvier.png')
  est=pg.evaluate("liInt(D.placements[0],2026)");print('livret estimé',est['amount'],'B0',est['B0']);assert est['B0']==7700 and 100<est['amount']<200
  f='form.qint[data-pid=pl1]';pg.fill(f+' [name=amount]','131,25');pg.click(f+' button:not([type])');pg.wait_for_timeout(300)
  li=pg.evaluate("[D.interests.find(i=>i.id==='int-pl1-2026'),D.placements[0].capital]");print(li);assert li[0]['amount']==131.25 and li[0]['added'] and li[1]==8131.25
  f='form.qint[data-pid=pl2]';pg.fill(f+' [name=rate]','2,5');pg.click(f+' button:not([type])');pg.wait_for_timeout(300)
  av=pg.evaluate("D.interests.find(i=>i.id==='int-pl2-2026')");print(av);assert av['amount']==round(10500*0.6*0.025,2) and av['rate']==2.5
  assert 'à valider' not in pg.inner_text('#view');print('VALIDATION INTÉRÊTS OK')
  pg.evaluate("go('epargne')");pg.wait_for_timeout(1200);t=pg.inner_text('#view');assert '2026' in t and '288,75' in t.replace('\u202f',' ').replace('\xa0',' '),t[:400]
  v=pg.evaluate(AX);print('AXE intérêts',v);assert not v;pg.evaluate("document.getElementById('sec-interets').scrollIntoView()");pg.wait_for_timeout(300);pg.screenshot(path=f'{OUT}/v7-5-recap-interets.png')
  pg.evaluate("go('bilans')");pg.wait_for_timeout(500);pg.click('[data-rep="rep-2026-12"]');pg.wait_for_timeout(500);v=pg.evaluate(AX);print('AXE bilan',v);assert not v
  pg.screenshot(path=f'{OUT}/v7-6-bilan-du-mois.png')
  pg.evaluate("closeSheet()");pg.evaluate("go('placements')");pg.evaluate("placSheet('pl1')");pg.wait_for_timeout(400)
  pg.fill('#fMov [name=amount]','-500');pg.fill('#fMov [name=date]','2027-01-20');pg.click('#fMov button');pg.wait_for_timeout(300)
  assert pg.evaluate("D.movements.length")==1;v=pg.evaluate(AX);print('AXE livret',v);assert not v
  pg.evaluate("closeSheet()");pg.evaluate("placSheet('pl2')");pg.wait_for_timeout(400);assert 'Fonds euros ≈' in pg.inner_text('#sheet')
  # comptes : toutes largeurs
  for w in (360,390,430):
    q=page(w);q.evaluate("budgetSeg='comptes';go('budget')");q.wait_for_timeout(700);q.add_script_tag(path='/tmp/axe.min.js');v=q.evaluate(AX);print('AXE comptes',w,v);assert not v
    sw=q.evaluate("document.documentElement.scrollWidth");assert sw<=w,('débordement',w,sw)
    for t in ['accueil','assurances','epargne','bilans','placements','reglages']:
      q.evaluate(f"go('{t}')");q.wait_for_timeout(250);sw=q.evaluate("document.documentElement.scrollWidth");assert sw<=w,('débordement',t,w,sw)
    if w==360:q.evaluate("budgetSeg='comptes';go('budget')");q.wait_for_timeout(1000);q.screenshot(path=f'{OUT}/v7-2-comptes-360.png')
    q.context.close()
  print('LARGEURS 360/390/430 OK')
  b.close()
finally:srv.terminate()
print('ERREURS',errs);assert not errs;print('INTÉRÊTS/BILANS OK')
