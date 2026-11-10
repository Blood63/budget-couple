"""v17 : prélèvements des mois courts, snapshot patrimoine non réécrit, catégorie abonnement,
toasts qui passent à la ligne, case « échéance de cette année reste à payer », go() sur l’onglet courant,
export CSV payeur. Données fictives, aucun Supabase réel."""
import subprocess,time,json,os,sys
sys.path.insert(0,os.path.dirname(__file__));from fake_supabase import Fake
from playwright.sync_api import sync_playwright
ROOT=os.path.join(os.path.dirname(__file__),'..','..');OUT=os.environ.get('OUT','/tmp/v17');os.makedirs(OUT,exist_ok=True)
PORT=18775;srv=subprocess.Popen(['python3','-m','http.server',str(PORT)],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
URL=f'http://localhost:{PORT}/'
CFG={"url":"https://exemple-fictif.supabase.co","key":"sb_publishable_FICTIF","space":"Exemple-espace-0000"}
norm=lambda s:s.replace('\u202f',' ').replace('\xa0',' ')
BASE={"version":15,"names":{"p1":"Alice","p2":"Bruno"},"ratio":50,"reminderDay":1,
 "fixed":[{"id":"f1","label":"Loyer fictif","amount":800,"day":5,"split":50,"category":"logement","paidBy":"joint"},
          {"id":"f2","label":"Internet fictif","amount":39.99,"day":31,"split":50,"category":"abonnement","paidBy":"p1"},
          {"id":"f3","label":"Mutuelle fictive","amount":120,"day":29,"split":50,"category":"sante","paidBy":"p2"}],
 "incomes":[{"id":"i1","person":"p1","type":"salaire","amount":2000,"recurring":True,"label":"Salaire fictif"}],
 "misc":[{"id":"m1","date":"2026-11-02","label":"Cadeau fictif","amount":40,"category":"cadeaux","paidBy":"p1","for":"p2","payer":"p2"},
         {"id":"m2","date":"2026-09-03","label":"PRLV SEPA STREAM FICTIF","amount":12.99,"category":"loisirs","paidBy":"joint","for":"common","source":"import"},
         {"id":"m3","date":"2026-10-03","label":"PRLV SEPA STREAM FICTIF","amount":12.99,"category":"loisirs","paidBy":"joint","for":"common","source":"import"},
         {"id":"m4","date":"2026-11-03","label":"PRLV SEPA STREAM FICTIF","amount":12.99,"category":"loisirs","paidBy":"joint","for":"common","source":"import"}],
 "months":[{"id":"s10","month":"2026-10","a":120,"b":60}],
 "placements":[{"id":"la","type":"livretA","name":"Livret A fictif","owner":"p1","capital":6000,"capitalDate":"2026-10-20"}],
 "accounts":[{"id":"acc-joint","label":"Compte joint fictif","bank":"Banque Fictive","owner":"joint","balance":500,"balanceDate":"2026-11-01"}],
 "annuals":[{"id":"an1","label":"Taxe fictive","amount":480,"month":3,"split":50,"saved":0,"since":"2026-01"}],
 "networth":[{"id":"nw-2026-11","month":"2026-11","p1":100,"p2":0,"common":0,"total":100,"assets":100,"debts":0}],
 "loans":[],"updated":1000}
errs=[];probes=[]
try:
 with sync_playwright() as p:
  b=p.chromium.launch()
  def dev(when,w=390,seed=BASE,scheme='dark',extra='',cfg=False,fake=None,name='d',who='p1'):
    c=b.new_context(viewport={'width':w,'height':900},locale='fr-FR',timezone_id='Europe/Paris',color_scheme=scheme)
    init="if(!sessionStorage.s){"+(f"localStorage.setItem('budget-couple-data',{json.dumps(json.dumps(seed))});" if seed is not None else '')+(f"localStorage.setItem('budget-couple-cfg',{json.dumps(json.dumps(CFG))});" if cfg else '')+f"localStorage.setItem('budget-couple-me','{who}');sessionStorage.setItem('budget-couple-more','1');sessionStorage.s=1}}"
    c.add_init_script(init+extra)
    if fake:c.route('**/*supabase.co/**',lambda r:fake.handle(r,name))
    c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(URL) else r.abort(),) if not fake else c.route(lambda u:u.startswith(URL),lambda r:r.continue_())
    pg=c.new_page();pg.on('pageerror',lambda e:errs.append(name+': '+str(e)));pg.on('console',lambda m:m.type=='error' and errs.append(name+': '+m.text));pg.on('dialog',lambda d:d.accept())
    pg.clock.install(time=when);pg.goto(URL);pg.wait_for_function('RATES!==null');pg.wait_for_timeout(700)
    return pg
  data=lambda pg:pg.evaluate('JSON.parse(localStorage.getItem("budget-couple-data"))')
  ovf=lambda pg,w:pg.evaluate('document.documentElement.scrollWidth')<=w+1
  AX="axe.run(document,{runOnly:['wcag2a','wcag2aa']}).then(r=>r.violations.map(v=>v.id+':'+v.nodes.length))"

  # 1) nextCharges : 15 et 28 février 2026, 29 février 2028
  pg=dev('2026-02-15T10:00:00+01:00');nc=pg.evaluate("nextCharges(8).map(f=>({label:f.label,day:f.day,inDays:f.inDays}))")
  print('FEB15',nc)
  inet=next(x for x in nc if 'Internet' in x['label']);mut=next(x for x in nc if 'Mutuelle' in x['label'])
  assert inet['day']==28 and inet['inDays']==13,(inet)
  assert mut['day']==28 and mut['inDays']==13,(mut)
  t=norm(pg.inner_text('main'));assert 'Internet fictif' in t and 'Dans 13 jours' in t
  pg.screenshot(path=f'{OUT}/v17-feb15-accueil-390.png',full_page=True);pg.context.close()

  pg=dev('2026-02-28T10:00:00+01:00')
  nc=pg.evaluate("nextCharges(8).map(f=>({label:f.label,day:f.day,inDays:f.inDays}))")
  print('FEB28',nc)
  assert all(x['inDays']==0 for x in nc if x['day']==28)
  t=norm(pg.inner_text('main'));assert 'Aujourd’hui' in t or "Aujourd'hui" in t
  pg.screenshot(path=f'{OUT}/v17-feb28-accueil-390.png',full_page=True);pg.context.close()

  pg=dev('2028-02-29T10:00:00+01:00')
  nc=pg.evaluate("nextCharges(8).map(f=>({label:f.label,day:f.day,inDays:f.inDays}))")
  print('FEB29',nc)
  assert next(x for x in nc if 'Internet' in x['label'])=={'label':'Internet fictif','day':29,'inDays':0}
  pg.context.close()

  # 2) nwSnapshot ne réécrit pas un point existant
  pg=dev('2026-11-10T10:00:00+01:00')
  before=pg.evaluate("D.networth.find(n=>n.id==='nw-2026-11')")
  pg.evaluate("go('patrimoine')");pg.wait_for_timeout(400)
  pg.evaluate("D.accounts[0].balance=9999;go('accueil')");pg.wait_for_timeout(100)
  pg.evaluate("go('patrimoine')");pg.wait_for_timeout(500)
  after=pg.evaluate("D.networth.find(n=>n.id==='nw-2026-11')")
  print('NW',before,after)
  assert after['total']==before['total']==100
  assert after['assets']==before['assets']==100
  pg.context.close()

  # 3) abonnement détecté → catégorie abonnement
  pg=dev('2026-11-10T10:00:00+01:00')
  pg.evaluate("go('budget');budgetSeg='diverses';render()");pg.wait_for_timeout(400)
  assert pg.locator('#subsCard').count()==1
  pg.evaluate("document.querySelector('[data-sub-fix]').click()");pg.wait_for_timeout(300)
  fx=[f for f in data(pg)['fixed'] if 'STREAM' in f['label']]
  print('SUBFIX',fx);assert fx and fx[0]['category']=='abonnement'
  pg.context.close()

  # 4) toasts longs : pas de coupe, contraste, bouton Annuler cliquable
  for w,sc in ((320,'dark'),(390,'light'),(1280,'dark')):
    pg=dev('2026-11-10T10:00:00+01:00',w=w,scheme=sc);pg.add_script_tag(path='/tmp/axe.min.js')
    pg.evaluate("toastUndo('Échéance payée : encore en retard pour janvier 2028 — message long de contrôle',()=>{})")
    pg.wait_for_timeout(400)
    tw=pg.evaluate("""() => {const t=document.getElementById('toast');const r=t.getBoundingClientRect();return {left:r.left,right:r.right,vw:innerWidth,sw:t.scrollWidth,cw:t.clientWidth,wrap:getComputedStyle(t).whiteSpace,undo:!!t.querySelector('.toast-undo')};}""")
    print('TOAST',w,sc,tw)
    assert tw['wrap']=='normal' and tw['undo']
    assert tw['sw']<=tw['cw']+2,(w,sc,tw)
    assert tw['cw']>=min(w-40,280),(w,sc,tw)
    assert tw['left']>=-2 and tw['right']<=tw['vw']+2
    v=pg.evaluate("axe.run('#toast',{runOnly:['wcag2aa']}).then(r=>r.violations.map(v=>v.id))");assert not v,(w,sc,v)
    pg.screenshot(path=f'{OUT}/v17-toast-{w}-{sc}.png')
    # Annuler reste utilisable
    pg.evaluate("document.querySelector('.toast-undo').click()")
    pg.context.close()

  # 5) case « échéance de cette année reste à payer » (création seulement)
  pg=dev('2026-11-05T10:00:00+01:00')
  pg.evaluate("go('budget')");pg.evaluate("annualSheet()");pg.wait_for_timeout(200)
  pg.fill('#fAnnual [name=label]','Cadeaux fictifs');pg.fill('#fAnnual [name=amount]','300');pg.select_option('#fAnnual [name=month]','3')
  assert pg.locator('#annUnpaidWrap').is_visible()
  pg.click('#fAnnual .btn');pg.wait_for_timeout(300)
  n=[a for a in data(pg)['annuals'] if a['label']=='Cadeaux fictifs'][0]
  assert n['since']=='2026-11' and pg.evaluate("annualPlan(annIn(D.annuals.find(a=>a.label==='Cadeaux fictifs')),curMonth()).late")==False
  pg.context.close()

  pg=dev('2026-11-05T10:00:00+01:00')
  pg.evaluate("go('budget')");pg.evaluate("annualSheet()");pg.wait_for_timeout(200)
  pg.fill('#fAnnual [name=label]','Taxe encore due');pg.fill('#fAnnual [name=amount]','900');pg.select_option('#fAnnual [name=month]','3')
  pg.check('#fAnnual [name=unpaidThisYear]');pg.click('#fAnnual .btn');pg.wait_for_timeout(300)
  n=[a for a in data(pg)['annuals'] if a['label']=='Taxe encore due'][0]
  print('UNPAID',n)
  assert n['since']=='2026-03'
  assert pg.evaluate("annualPlan(annIn(D.annuals.find(a=>a.label==='Taxe encore due')),curMonth()).late")==True
  pg.evaluate("go('accueil')");pg.wait_for_timeout(300)
  assert 'Taxe encore due' in norm(pg.inner_text('#annLate'))
  pg.screenshot(path=f'{OUT}/v17-annuelle-impayee-390.png',full_page=True)
  # édition : pas de case, champ paidYear inchangé
  pg.evaluate("go('budget')");pg.evaluate("annualSheet('an1')");pg.wait_for_timeout(200)
  assert pg.locator('#annUnpaidWrap').count()==0 and pg.locator('#fAnnual [name=paidYear]').count()==1
  pg.context.close()

  # 6) go() applique le segment même si l’onglet Budget est déjà ouvert
  pg=dev('2026-11-10T10:00:00+01:00')
  pg.evaluate("go('budget');budgetSeg='revenus';render()");pg.wait_for_timeout(300)
  assert pg.locator('#sec-annuels').count()==0
  pg.evaluate("budgetSeg='fixes';go('budget')");pg.wait_for_timeout(300)
  assert pg.locator('#sec-annuels').count()==1
  pg.context.close()

  # 7) export CSV : colonne « payé par » = payeur (Alice), pas le bénéficiaire
  pg=dev('2026-11-10T10:00:00+01:00')
  pg.evaluate("go('reglages')");pg.wait_for_timeout(200)
  with pg.expect_download() as dl:pg.click('#expCsv')
  body=dl.value.path();txt=open(body,encoding='utf-8-sig').read()
  print('CSV',txt.splitlines()[0], [ln for ln in txt.splitlines() if ln.startswith('dépense')][:2])
  assert txt.splitlines()[0].startswith('type;date/mois;libellé;catégorie;montant;payé par')
  cadeau=next(ln for ln in txt.splitlines() if 'Cadeau fictif' in ln)
  assert 'Alice' in cadeau and cadeau.count('Bruno')==0
  pg.context.close()

  # 8) largeurs / thèmes + axe sur accueil et charges
  for w,sc in ((320,'light'),(390,'dark'),(1280,'light')):
    pg=dev('2026-11-10T10:00:00+01:00',w=w,scheme=sc);pg.add_script_tag(path='/tmp/axe.min.js')
    v=pg.evaluate(AX);assert not v,(w,sc,'accueil',v);assert ovf(pg,w)
    pg.screenshot(path=f'{OUT}/v17-accueil-{w}-{sc}.png',full_page=True)
    pg.evaluate("go('budget');budgetSeg='fixes';render()");pg.wait_for_timeout(250)
    v=pg.evaluate(AX);assert not v,(w,sc,'fixes',v);assert ovf(pg,w)
    pg.screenshot(path=f'{OUT}/v17-charges-{w}-{sc}.png',full_page=True)
    pg.context.close()

  print('ERREURS',errs);assert not errs;print('V17 OK')
  b.close()
finally:srv.terminate()
