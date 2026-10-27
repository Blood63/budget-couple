"""Import de relevés fictifs (PDF type BNP / Crédit Mutuel / Boursorama, CSV, OFX, QIF) : revue, rapprochement, doublons, apprentissage, annulation ; intérêts dans Épargne."""
import subprocess,time,json,os
from playwright.sync_api import sync_playwright
ROOT=os.path.join(os.path.dirname(__file__),'..','..');FX=os.path.join(ROOT,'tests','fixtures');OUT=os.environ.get('OUT','/tmp')
srv=subprocess.Popen(['python3','-m','http.server','18766'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
D={"version":8,"names":{"p1":"Paul","p2":"Lucie"},"ratio":50,
 "accounts":[{"id":"acc-joint","label":"Compte joint","bank":"Banque exemple","owner":"joint","feed":{"p1":900,"p2":800,"day":1}},{"id":"acc-p1","label":"Compte Paul","owner":"p1"},{"id":"acc-p2","label":"Compte Lucie","owner":"p2"}],
 "fixed":[{"id":"f1","label":"Loyer","amount":950,"day":5,"split":50,"category":"logement","paidBy":"joint","account":"acc-joint"},{"id":"f2","label":"Électricité EDF","amount":75,"day":8,"split":50,"category":"energie","paidBy":"joint","account":"acc-joint"},
   {"id":"f3","label":"Forfait Free","amount":19.99,"day":12,"split":50,"category":"abonnement","paidBy":"joint","account":"acc-joint"}],
 "incomes":[{"id":"i1","person":"p1","type":"salaire","amount":2400,"recurring":True,"account":"acc-p1"}],
 "misc":[{"id":"man1","date":"2026-09-03","label":"Courses","amount":54.2,"category":"courses","paidBy":"joint","for":"common","payer":"common"}],
 "placements":[{"id":"pl1","type":"livretA","name":"Livret A","owner":"common","capital":5000,"monthly":100,"rateMode":"auto"}],"months":[],"goals":[],"transfer":{"amount":0}}
AX="axe.run(document,{runOnly:['wcag2a','wcag2aa']}).then(r=>r.violations.map(v=>v.id+':'+v.nodes.length))"
errs=[]
def counts(pg):return pg.evaluate("(()=>{const c={};RV.rows.filter(r=>!r.del).forEach(r=>c[r.type]=(c[r.type]||0)+1);return c})()")
try:
 with sync_playwright() as p:
  b=p.chromium.launch()
  c=b.new_context(viewport={'width':390,'height':844},locale='fr-FR',timezone_id='Europe/Paris')
  c.add_init_script("sessionStorage.setItem('budget-couple-more','1')");c.add_init_script(f"if(!sessionStorage.s){{localStorage.setItem('budget-couple-data',{json.dumps(json.dumps(D))});localStorage.setItem('budget-couple-me','p1');sessionStorage.s=1}}")
  pg=c.new_page();pg.clock.install(time='2026-10-03T10:00:00+02:00');pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:m.type=='error' and errs.append(m.text))
  pg.goto('http://localhost:18766/');pg.wait_for_function('RATES!==null');pg.wait_for_timeout(500);pg.add_script_tag(path='/tmp/axe.min.js')
  assert pg.evaluate('D.version')==14
  def open_import(f):
    pg.evaluate("budgetSeg='diverses';go('budget')");pg.wait_for_timeout(200);pg.click('#impStmt');pg.select_option('#impAcc','acc-joint');pg.set_input_files('#impFile',os.path.join(FX,f))
    pg.wait_for_selector('#rvList',timeout=20000)
  # 1. PDF type BNP : revue complète
  open_import('releve-bnp-fictif.pdf');REF=pg.evaluate("RV.rows.map(r=>normLabel(r.label))");cn=counts(pg);print('BNP PDF',cn);assert cn=={'virement':3,'charge':3,'epargne':1,'exclu':1,'depense':9},cn
  assert pg.evaluate("RV.rows.find(r=>/CARREFOUR/.test(r.label)).note").startswith('Doublon')
  v=pg.evaluate(AX);print('AXE revue',v);assert not v
  pg.screenshot(path=f'{OUT}/v8-1-revue-releve.png')
  i=pg.evaluate("RV.rows.findIndex(r=>/MAGASIN XYZ/.test(r.label))");pg.select_option(f'#rvList [data-i="{i}"] [data-k=category]','cadeaux')
  j=pg.evaluate("RV.rows.findIndex(r=>/IKEA/.test(r.label))");pg.click(f'[data-rv-del="{j}"]');assert counts(pg)['depense']==8;pg.click('.toast-undo');pg.wait_for_timeout(200);assert counts(pg)['depense']==9;print('suppression de ligne + annulation OK')
  k=pg.evaluate("RV.rows.findIndex(r=>/AMAZON/.test(r.label))");pg.select_option(f'#rvList [data-i="{k}"] [data-k=paidBy]','p2')
  n0=pg.evaluate('D.misc.length');pg.click('#rvOk');pg.wait_for_timeout(500)
  assert pg.evaluate('D.misc.length')==n0+9;assert pg.evaluate("D.misc.find(m=>/AMAZON/.test(m.label)).paidBy")=='p2';assert pg.evaluate("D.catrules.map(r=>r.category)")==['cadeaux']
  t=pg.inner_text('#sheet');assert 'Import terminé' in t and 'par catégorie' in t.lower();v=pg.evaluate(AX);print('AXE récap',v);assert not v;pg.screenshot(path=f'{OUT}/v8-2-recap-import.png')
  # 2. réimport (CSV de la même banque) : tout est reconnu comme déjà importé
  pg.evaluate("closeSheet()");pg.wait_for_timeout(300);open_import('releve-bnp-fictif.csv');cn=counts(pg);print('réimport',cn);assert cn=={'exclu':17},cn
  pg.click('#rvOk');pg.wait_for_timeout(300);assert pg.evaluate('D.misc.length')==n0+9;print('DOUBLONS OK')
  # 3. annuler un import puis rétablir
  bnp=pg.evaluate("D.imports[0].id");pg.evaluate(f"importRecap('{bnp}')");pg.click('[data-imp-undo]');pg.wait_for_timeout(300);assert pg.evaluate('D.misc.length')==n0
  pg.click('.toast-undo');pg.wait_for_timeout(300);assert pg.evaluate('D.misc.length')==n0+9;print('ANNULATION IMPORT OK')
  # 4. autres banques / formats : lecture + catégorie apprise
  for f in ['releve-creditmutuel-fictif.pdf','releve-boursorama-fictif.pdf','releve-creditmutuel-fictif.csv','releve-boursorama-fictif.csv','releve-fictif.ofx','releve-fictif.qif']:
    pg.evaluate("D.imports=[];closeSheet()");pg.wait_for_timeout(300);open_import(f);cn=counts(pg);tot=pg.evaluate("Math.round(RV.rows.reduce((s,r)=>s+r.amount,0)*100)/100")
    cat=pg.evaluate("RV.rows.find(r=>/MAGASIN XYZ/.test(r.label)).category");labs=pg.evaluate("RV.rows.map(r=>normLabel(r.label))");assert labs==REF,(f,[x for x in zip(labs,REF) if x[0]!=x[1]]);print(f,len(pg.evaluate('RV.rows')),tot,cn.get('charge'),cat)
    assert len(pg.evaluate('RV.rows'))==17 and tot==32.87 and cn.get('charge')==3 and cn.get('virement')==3 and cat=='cadeaux',(f,cn)
    pg.click('#rvCancel')
  pg.evaluate("location.reload()") if False else None
  # 5. dépenses : modifier, supprimer + annuler
  pg.evaluate("closeSheet();D.miscMonth='2026-09';budgetSeg='diverses';go('budget')");pg.wait_for_timeout(400);pg.screenshot(path=f'{OUT}/v8-3-depenses-importees.png')
  pg.click('[data-edit-misc="man1"]');pg.fill('#fMisc [name=amount]','60,10');pg.click('#fMisc button:not([type])');pg.wait_for_timeout(300);assert pg.evaluate("D.misc.find(m=>m.id==='man1').amount")==60.1
  pg.click('[data-del-misc="man1"]');pg.wait_for_timeout(200);assert not pg.evaluate("D.misc.some(m=>m.id==='man1')");pg.click('.toast-undo');pg.wait_for_timeout(300)
  assert pg.evaluate("D.misc.some(m=>m.id==='man1')");v=pg.evaluate(AX);print('AXE dépenses',v);assert not v;print('MODIFIER / SUPPRIMER / ANNULER OK')
  # 6. intérêts dans Épargne + raccourci accueil
  pg.evaluate("go('accueil')");pg.wait_for_timeout(300);pg.click('.shortcuts [data-scroll="sec-interets"]');pg.wait_for_timeout(500)
  assert pg.evaluate("tab")=='epargne' and pg.evaluate("document.getElementById('sec-interets').getBoundingClientRect().top")<200;v=pg.evaluate(AX);print('AXE épargne',v);assert not v
  pg.screenshot(path=f'{OUT}/v8-4-epargne-interets.png');print('INTÉRÊTS DANS ÉPARGNE OK')
  # 7. 360 px : pas de débordement dans la revue
  pg.set_viewport_size({'width':360,'height':800});open_import('releve-boursorama-fictif.pdf');assert pg.evaluate("document.querySelector('#sheetBody').scrollWidth<=document.querySelector('#sheetBody').clientWidth+1");pg.screenshot(path=f'{OUT}/v8-5-revue-360.png');print('360 OK')
  b.close()
finally:srv.terminate()
print('ERREURS',errs);assert not errs;print('RELEVÉS OK')
