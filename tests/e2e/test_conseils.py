"""Playwright : Conseils pédagogiques (règles, masquage, disclaimer), âge, estimation de l'impôt, migration v6→v7. Données fictives."""
import subprocess,time,json,os,re
from playwright.sync_api import sync_playwright
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..');OUT=os.environ.get('SHOTS','/tmp')
srv=subprocess.Popen(['python3','-m','http.server','18766'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
errs=[];NOW=int(time.time()*1000)
V6={"version":6,"updated":1,"ratio":55,"reminderDay":1,
 "incomes":[{"id":"i1","person":"p1","type":"salaire","label":"Salaire (exemple)","amount":3200,"recurring":True},{"id":"i2","person":"p2","type":"salaire","label":"Salaire (exemple)","amount":2100,"recurring":True}],
 "fixed":[{"id":"f1","label":"Loyer (exemple)","amount":1100,"split":55,"category":"logement","paidBy":"joint","day":5},{"id":"f2","label":"Énergie (exemple)","amount":400,"split":55,"category":"autre","paidBy":"joint","day":10},
   {"id":"f3","label":"Abonnement (exemple)","amount":100,"split":55,"category":"autre","paidBy":"p1","day":12,"c":NOW-2*86400000}],
 "misc":[{"id":"m1","date":"2026-08-10","amount":300,"label":"Courses","category":"courses","payer":"p1","for":"common"},{"id":"m2","date":"2026-09-10","amount":320,"label":"Courses","category":"courses","payer":"p2","for":"common"},
   {"id":"m3","date":"2026-10-05","amount":600,"label":"Courses","category":"courses","payer":"p1","for":"common"}],
 "months":[{"id":"mo1","month":"2026-10","a":200,"b":100}],
 "goals":[{"id":"g1","name":"Voyage (exemple)","owner":"common","target":5000,"saved":1000,"date":"2027-03"}],
 "placements":[{"id":"la","type":"livretA","name":"Livret A (exemple)","bank":"Banque Exemple","owner":"p1","capital":22950,"monthly":100,"rateMode":"auto"},
   {"id":"ld","type":"ldds","name":"LDDS (exemple)","bank":"Banque Exemple","owner":"p1","capital":11500,"monthly":100,"rateMode":"auto"},
   {"id":"lj","type":"livretJeune","name":"Livret Jeune (exemple)","bank":"Banque Exemple","owner":"p2","capital":1500,"monthly":0,"rate":3,"rateMode":"manual"},
   {"id":"ce","type":"cel","name":"CEL (exemple)","bank":"Banque Exemple","owner":"p2","capital":2000,"monthly":50,"rateMode":"auto"},
   {"id":"pe","type":"pel","name":"PEL (exemple)","bank":"Banque Exemple","owner":"p1","capital":9000,"monthly":45,"rate":2.5,"openDate":"2015-05-01"}]}
BAD=re.compile(r'\b(achetez|vendez|investissez dans|nous recommandons|MSCI|S&P|Amundi|iShares|Lyxor)\b',re.I)
with sync_playwright() as p:
  b=p.chromium.launch();c=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True,locale='fr-FR')
  c.add_init_script(f"if(!sessionStorage.s){{localStorage.setItem('budget-couple-data',{json.dumps(json.dumps(V6))});localStorage.setItem('budget-couple-me','p1');sessionStorage.s=1}}")
  pg=c.new_page();pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:m.type=='error' and errs.append(m.text));pg.on('dialog',lambda d:d.accept())
  pg.goto('http://localhost:18766/');pg.wait_for_function('RATES!==null');pg.wait_for_timeout(300);pg.evaluate('render()')
  d=pg.evaluate('D');assert d['version']==7 and d['births']=={'p1':'2000-06-22','p2':'2002-03-10'} and d['dismissed']==[] and d['tax']['mode']=='separe' and len(d['placements'])==5
  assert pg.evaluate("[ageOf('p1'),ageOf('p2')]")==[26,24];print('MIGRATION v6→v7 OK, âges 26 / 24')
  T=pg.evaluate('tips()');K={t['key']:t for t in T};print(len(T),'conseils :',sorted(K))
  need=['precaution-high','ceil-full-la','ceil-near-ld','ceil-near-lj','lep-p1','lep-p2','order-ce-lj','pel10-pe','rate-2026-10','goal-slow-g1','misc-up-2026-10','lj-end-p2','per-p1','pea-date-p1','av-date-p2','idle-2026-10']
  miss=[k for k in need if k not in K];assert not miss,miss
  assert not any(k.startswith('per-p2') for k in K),'pas de PER à TMI 11 %'
  assert 'fixed-up-f3' in K and 'rest-2026-10' not in K and 'lj-elig-p1' not in K
  assert '31/12/2027' in K['lj-end-p2']['title'] and 'TMI 30' in K['per-p1']['title'] and 'bloqué' in K['per-p1']['text'] and '30 %' in K['per-p1']['text']
  for t in T:
    assert t['why'] and t['text'] and not BAD.search(t['text']+t['why']),t['key']
  assert 'service-public' in K['lep-p1']['link'] and '23 028' in K['lep-p1']['why'].replace('\u202f',' ').replace('\xa0',' ')
  print('RÈGLES OK, aucune recommandation de produit')
  # Accueil : carte Conseils (2 premiers + disclaimer)
  pg.wait_for_timeout(800);card=pg.locator('.tips-card');assert card.count()==1 and card.locator('.tip').count()==2 and 'pas des conseils en investissement' in card.inner_text()
  card.scroll_into_view_if_needed();pg.wait_for_timeout(300);pg.screenshot(path=f'{OUT}/v5-conseils.png')
  first=card.locator('.tip').first.locator('b').inner_text().strip()
  card.locator('[data-hide-tip]').first.click();pg.wait_for_timeout(300)
  assert pg.evaluate('D.dismissed.length')==1 and first not in pg.locator('.tips-card').inner_text();print('MASQUER OK :',first)
  # Placements : liste complète + réafficher
  pg.click('.tips-card [data-goto=placements]');pg.wait_for_timeout(1000)
  n=pg.locator('#tips .tip').count();assert n==len(T)-1,(n,len(T));assert pg.locator('#tips .disclaimer').count()==1
  pg.evaluate("document.getElementById('tips').scrollIntoView({block:'start'})");pg.wait_for_timeout(300);pg.screenshot(path=f'{OUT}/v5-conseils-liste.png')
  pg.click('#showTips');pg.wait_for_timeout(300);assert pg.locator('#tips .tip').count()==len(T) and pg.evaluate('D.dismissed.length')==0;print('LISTE + RÉAFFICHER OK',n+1)
  # Revenus : estimation de l'impôt
  pg.click('[data-tab=budget]');pg.wait_for_timeout(300);pg.click('[data-seg=revenus]');pg.wait_for_timeout(800)
  t=pg.evaluate('taxNow()');print('IMPÔT séparé',t['sep']['p1']['net'],'+',t['sep']['p2']['net'],'=',t['sep']['total'],'| commun',t['com']['net'],'| TMI',t['tmi'])
  # vérification indépendante (barème 2026) : p1 38400 - 3840 = 34560 ; p2 25200 - 2520 = 22680
  def ir(R,parts):
    q=R/parts;tr=[(11600,0),(29579,.11),(84577,.30),(181917,.41),(1e18,.45)];lo=0;s=0
    for hi,r in tr:
      if q>lo:s+=(min(q,hi)-lo)*r
      lo=hi
    return s*parts
  def net(R,parts,base):
    br=ir(R,parts);th,bs=(3277,1483) if base==2 else (1982,897)
    if br<th:br-=min(br,max(0,bs-.4525*br))
    return 0 if br<61 else round(br)
  assert t['sep']['p1']['net']==net(34560,1,1) and t['sep']['p2']['net']==net(22680,1,1) and t['com']['net']==net(57240,2,2) and t['tmi']=={'p1':30,'p2':11}
  tc=pg.locator('.tax-card');assert 'approximative' in tc.inner_text() and 'prélèvements sociaux' in tc.inner_text()
  tc.scroll_into_view_if_needed();pg.wait_for_timeout(2600);pg.screenshot(path=f'{OUT}/v5-impot.png')
  pg.select_option('#fTax [name=mode]','commune');pg.wait_for_timeout(300);assert pg.evaluate('D.tax.mode')=='commune'
  assert pg.evaluate("taxNow().tmi.p2")==pg.evaluate("taxNow().com.tmi")
  pg.fill('#fTax [name=children]','2');pg.dispatch_event('#fTax [name=children]','change');pg.wait_for_timeout(300);assert pg.evaluate('taxNow().com.parts')==3;print('SITUATION FISCALE OK (commune, 2 enfants → 3 parts)')
  pg.select_option('#fTax [name=mode]','separe');pg.wait_for_timeout(200);pg.fill('#fTax [name=children]','0');pg.dispatch_event('#fTax [name=children]','change');pg.wait_for_timeout(200)
  # Réglages : dates de naissance préremplies et modifiables
  pg.click('#gear');pg.wait_for_timeout(500);assert pg.input_value('#fNames [name=b2]')=='2002-03-10' and pg.input_value('#fNames [name=b1]')=='2000-06-22'
  pg.locator('#fNames [name=b1]').scroll_into_view_if_needed();pg.wait_for_timeout(2500);assert pg.evaluate('document.documentElement.scrollWidth')<=390;pg.screenshot(path=f'{OUT}/v5-reglages-naissance.png')
  pg.fill('#fNames [name=b1]','2004-01-15');pg.click('#fNames .btn');pg.wait_for_timeout(300)
  K2={t['key'] for t in pg.evaluate('tips()')};assert pg.evaluate("ageOf('p1')")==22 and 'lj-elig-p1' in K2;print('NAISSANCE modifiée → Livret Jeune éligible pour p1 OK')
  pg.fill('#fNames [name=b1]','2000-06-22');pg.click('#fNames .btn');pg.wait_for_timeout(200)
  pg.add_script_tag(path='/tmp/axe.min.js')
  for tb in ['accueil','placements']:
    pg.click(f'[data-tab={tb}]');pg.wait_for_timeout(900);v=pg.evaluate("axe.run(document,{runOnly:['wcag2a','wcag2aa']}).then(r=>r.violations.map(v=>v.id+':'+v.nodes.length))");print('AXE',tb,v);assert not v
  pg.click('[data-tab=budget]');pg.click('[data-seg=revenus]');pg.wait_for_timeout(900);v=pg.evaluate("axe.run(document,{runOnly:['wcag2a','wcag2aa']}).then(r=>r.violations.map(v=>v.id+':'+v.nodes.length))");print('AXE revenus',v);assert not v
  b.close()
srv.terminate();print('ERREURS:',errs);assert not errs
