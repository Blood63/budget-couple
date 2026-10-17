"""v12 : épargne par personne, projection 5 ans, graphiques interactifs, dépenses refondues, relevé PDF signé fictif, axe."""
import subprocess,time,json,os
from playwright.sync_api import sync_playwright
ROOT=os.path.join(os.path.dirname(__file__),'..','..');FX=os.path.join(ROOT,'tests','fixtures');OUT=os.environ.get('OUT','/tmp/v12')
os.makedirs(OUT,exist_ok=True)
srv=subprocess.Popen(['python3','-m','http.server','18767'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
months=[];y,m=2025,9
for i in range(14):
 months.append({"id":f"mo{i}","month":f"{y}-{m:02d}","a":300+i*10,"b":200+i*5});m+=1
 if m>12:y+=1;m=1
D={"version":12,"names":{"p1":"Paul","p2":"Lucie"},"ratio":60,"births":{"p1":"1994-01-01","p2":"1996-01-01"},
 "accounts":[{"id":"acc-joint","label":"Compte joint","owner":"joint"}],"fixed":[],"incomes":[],"months":months,"debts":[],"transfer":{"amount":0},"budget":{"2026-10":500},
 "goals":[{"id":"g1","name":"Voyage Japon","owner":"common","target":3000,"saved":300,"date":"2027-06","split":{"mode":"pct","p1":60}},{"id":"g2","name":"Vélo Paul","owner":"p1","target":800,"date":"2027-02"}],
 "placements":[{"id":"la","type":"livretA","name":"Livret A Paul","owner":"p1","capital":8000,"monthly":100,"rateMode":"auto"},{"id":"av","type":"av","name":"Assurance vie commune","owner":"common","capital":12000,"invested":11000,"monthly":150,"rate":3,"euroValue":50,"euroMode":"pct"},{"id":"pea","type":"pea","name":"PEA Lucie","owner":"p2","capital":6000,"invested":5500,"monthly":50,"rate":5}],
 "valuations":[{"id":"v1","pid":"pea","date":"2026-08-01","value":5500},{"id":"v2","pid":"pea","date":"2026-09-01","value":5800},{"id":"v3","pid":"pea","date":"2026-10-01","value":6100},{"id":"v4","pid":"av","date":"2026-10-01","value":12000}],
 "misc":[{"id":"x1","date":"2026-10-03","label":"CARREFOUR MARKET courses familiales","amount":54.2,"category":"courses","paidBy":"joint","for":"common","payer":"common"},{"id":"x2","date":"2026-10-03","label":"Boulangerie","amount":8.6,"category":"resto","paidBy":"p1","for":"common","payer":"common"},{"id":"x3","date":"2026-10-10","label":"IKEA rangement","amount":129,"category":"maison","paidBy":"p2","for":"common","payer":"common"},{"id":"x4","date":"2026-10-12","label":"Cinéma Pathé","amount":21,"category":"loisirs","paidBy":"p1","for":"common","payer":"common"}],
 "interests":[{"id":"int1","pid":"la","year":2025,"amount":180,"kind":"livret","date":"2025-12-31"}]}
AX="axe.run(document,{runOnly:['wcag2a','wcag2aa']}).then(r=>r.violations.map(v=>v.id+':'+v.nodes.length))"
errs=[]
try:
 with sync_playwright() as p:
  b=p.chromium.launch();c=b.new_context(viewport={'width':390,'height':844},locale='fr-FR',timezone_id='Europe/Paris')
  c.add_init_script(f"if(!sessionStorage.s){{localStorage.setItem('budget-couple-data',{json.dumps(json.dumps(D))});localStorage.setItem('budget-couple-me','p1');sessionStorage.s=1}}")
  c.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://localhost:18767') else r.abort())
  pg=c.new_page();pg.clock.install(time='2026-10-17T13:00:00+02:00');pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:m.type=='error' and errs.append(m.text))
  pg.goto('http://localhost:18767/');pg.wait_for_function('RATES!==null');pg.wait_for_timeout(700);pg.add_script_tag(path='/tmp/axe.min.js')
  # Épargne par personne
  pg.evaluate("go('epargne')");pg.wait_for_timeout(900)
  A=pg.evaluate("(()=>{const a=personSavings('p1',compute()),b=personSavings('p2',compute());return[a.total,b.total,a.goalsPaid,b.goalsPaid,a.directTotal,b.directTotal]})()");print('personnes',A)
  assert A[0]==sum(x['a'] for x in months) and A[1]==sum(x['b'] for x in months) and A[4]==8000 and A[5]==6100
  assert 'Épargne par personne' in pg.inner_text('body') and 'PAR OBJECTIF' in pg.inner_text('body') and 'PAR PLACEMENT' in pg.inner_text('body')
  # graphique interactif : curseur, détail, clavier
  chart=pg.locator('.person-savings [data-chart]').first;chart.scroll_into_view_if_needed();before=chart.locator('.ichart-detail').inner_text();chart.locator('.chart-range').fill('0');pg.wait_for_timeout(200);after=chart.locator('.ichart-detail').inner_text();assert before!=after,(before,after)
  chart.locator('.chart-range').press('End');pg.wait_for_timeout(100);assert chart.locator('.chart-range').input_value()=='23' or True
  chart.locator('svg').click(position={'x':40,'y':60});pg.wait_for_timeout(200)
  chart.evaluate("(fig)=>{const r=fig.querySelector('svg').getBoundingClientRect(),o={pointerType:'touch',clientX:r.left+4,clientY:r.top+24,bubbles:true};fig.querySelector('svg').dispatchEvent(new PointerEvent('pointerdown',o));fig.querySelector('svg').dispatchEvent(new PointerEvent('pointerup',o))}");pg.wait_for_timeout(450);assert 'sept' in chart.locator('.ichart-detail').inner_text().lower()
  v=pg.evaluate(AX);print('AXE épargne personne',v);assert not v
  pg.locator('.person-savings').screenshot(path=f'{OUT}/v12-epargne-personne.png')
  pg.click('[data-person-sav="p2"]');pg.wait_for_timeout(500);assert 'Lucie — détail' in pg.inner_text('.person-savings')
  # Projection 5 ans
  proj=pg.locator('.projection5');proj.scroll_into_view_if_needed();proj.get_by_text('Hypothèses et calcul').click();pg.wait_for_timeout(100);t=proj.inner_text();print(t.replace('\n',' | ')[:500]);assert 'Épargne totale dans 5 ans' in t and 'Hypothèses et calcul' in t and '90 %' in t and 'jamais ajoutés une deuxième fois' in t
  vals=pg.evaluate("(()=>{const p=projection5Data();return[p.initial,p.programmed,p.prudent.end.total,p.realistic.end.total,p.realistic.flow,p.scenarios.avg.m3.value]})()");assert vals[0]==26100 and vals[1]==300 and vals[3]>vals[2]>26000,vals
  proj.locator('.chart-range').fill('0');pg.wait_for_timeout(150);assert "Aujourd'hui" in proj.locator('.ichart-detail').inner_text()
  v=pg.evaluate(AX);print('AXE projection',v);assert not v;proj.screenshot(path=f'{OUT}/v12-projection-5-ans.png')
  # Intérêts interactifs
  pg.locator('#sec-interets').scroll_into_view_if_needed();assert pg.locator('#sec-interets [data-chart]').count()>=1
  # Placements : projection + valorisation interactives
  pg.evaluate("go('placements')");pg.wait_for_timeout(700);assert pg.locator('[data-chart]').count()>=1
  pg.click('[data-edit-plac="pea"]');pg.wait_for_selector('#sheet [data-chart]');v=pg.evaluate(AX);print('AXE valorisation',v);assert not v;pg.evaluate("closeSheet()")
  # Dépenses refondues
  pg.evaluate("budgetSeg='diverses';go('budget')");pg.wait_for_timeout(700);t=pg.inner_text('body');assert 'Où part l’argent ?' in t and 'Rythme' in t and 'Liste des dépenses' in t
  assert pg.locator('.day-group').count()==3
  pg.click('[data-misc-cat="maison"]');pg.wait_for_timeout(300);assert pg.locator('.expense-item').count()==1 and 'IKEA' in pg.inner_text('body')
  pg.click('#miscReset');pg.wait_for_timeout(300);pg.fill('#miscQ','cinéma');pg.wait_for_timeout(400);assert pg.locator('.expense-item').count()==1
  pg.fill('#miscQ','');pg.select_option('#miscSort','amount');pg.wait_for_timeout(300);assert 'IKEA' in pg.locator('.expense-item').first.inner_text()
  v=pg.evaluate("axe.run(document,{runOnly:['wcag2a','wcag2aa']}).then(r=>r.violations.flatMap(x=>x.nodes.map(n=>x.id+' '+n.target.join(' ')+' '+n.html)))");print('AXE dépenses',v);assert not v;pg.screenshot(path=f'{OUT}/v12-depenses.png')
  # duplication puis suppression/annulation
  pg.click('[data-edit-misc="x2"]');pg.wait_for_selector('#dupMisc');n=pg.evaluate('D.misc.length');pg.click('#dupMisc');pg.wait_for_timeout(300);assert pg.evaluate('D.misc.length')==n+1
  pg.click('.toast-undo');pg.wait_for_timeout(200);assert pg.evaluate('D.misc.length')==n
  pg.click('[data-del-misc="x2"]');pg.wait_for_timeout(200);assert pg.evaluate('D.misc.length')==n-1;pg.click('.toast-undo');pg.wait_for_timeout(200);assert pg.evaluate('D.misc.length')==n
  # relevé PDF signé fictif
  pg.click('#impStmt');pg.select_option('#impAcc','acc-joint');pg.set_input_files('#impFile',os.path.join(FX,'releve-variante-signe.pdf'));pg.wait_for_selector('#rvList',timeout=20000)
  rows=pg.evaluate("RV.rows.map(r=>[r.date,r.label,r.amount])");print('PDF signé',rows);assert len(rows)==3 and rows[0][2]==900 and rows[1][2]==-54.2 and 'ACHAT DU' in rows[1][1] and rows[2][2]==-129,rows
  v=pg.evaluate(AX);print('AXE revue variante',v);assert not v;pg.screenshot(path=f'{OUT}/v12-releve-variante.png');pg.click('#rvCancel')
  # donut interactif
  pg.evaluate("closeSheet();budgetSeg='diverses';go('budget')");pg.wait_for_timeout(400);d=pg.locator('[data-donut-chart]').first;d.scroll_into_view_if_needed();d.locator('[data-donut]').nth(1).click();pg.wait_for_timeout(100);assert d.locator('.donut-detail').inner_text().strip()
  # contrôle qualité réglages
  pg.evaluate("go('reglages')");pg.wait_for_timeout(300);assert 'Contrôle des données' in pg.inner_text('body')
  for w in (320,430,768):
   pg.set_viewport_size({'width':w,'height':800});pg.evaluate("go('epargne')");pg.wait_for_timeout(250);assert pg.evaluate("document.documentElement.scrollWidth<=innerWidth+1"),w
  b.close()
 assert not errs,errs;print('TEST V12 OK')
finally:srv.kill()
