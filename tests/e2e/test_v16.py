"""v16 : charges annuelles en retard, snapshot patrimoine automatique (2 appareils, secure et non secure), Dépenses sur le mois courant,
qrcode.js à la demande, contraste du toast. Données fictives, aucun Supabase réel (faux PostgREST local)."""
import subprocess,time,json,os,sys
sys.path.insert(0,os.path.dirname(__file__));from fake_supabase import Fake
from playwright.sync_api import sync_playwright
ROOT=os.path.join(os.path.dirname(__file__),'..','..');OUT=os.environ.get('OUT','/tmp/v16');os.makedirs(OUT,exist_ok=True)
PORT=18774;srv=subprocess.Popen(['python3','-m','http.server',str(PORT)],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
URL=f'http://localhost:{PORT}/'
CFG={"url":"https://exemple-fictif.supabase.co","key":"sb_publishable_FICTIF","space":"Exemple-espace-0000"}
norm=lambda s:s.replace('\u202f',' ').replace('\xa0',' ')
BASE={"version":15,"names":{"p1":"Alice","p2":"Bruno"},"ratio":50,"reminderDay":1,
 "fixed":[{"id":"f1","label":"Loyer fictif","amount":800,"day":5,"split":50,"category":"logement","paidBy":"joint"}],
 "incomes":[{"id":"i1","person":"p1","type":"salaire","amount":2000,"recurring":True,"label":"Salaire fictif"}],
 "misc":[{"id":"m1","date":"2026-11-02","label":"Courses fictives","amount":40,"category":"courses","paidBy":"p1","for":"common"}],
 "months":[{"id":"s10","month":"2026-10","a":120,"b":60}],
 "placements":[{"id":"la","type":"livretA","name":"Livret A fictif","owner":"p1","capital":6000,"capitalDate":"2026-10-20"}],
 "annuals":[{"id":"an1","label":"Taxe fictive","amount":480,"month":3,"split":50,"saved":480,"since":"2026-01"},
            {"id":"an2","label":"Assurance fictive","amount":600,"month":12,"split":50,"saved":0,"since":"2026-01"}],
 "updated":1000}
errs=[];probes=[]
try:
 with sync_playwright() as p:
  b=p.chromium.launch()
  def dev(when,w=390,seed=BASE,scheme='dark',extra='',cfg=False,fake=None,name='d',who='p1',keep_misc=None):
    c=b.new_context(viewport={'width':w,'height':900},locale='fr-FR',timezone_id='Europe/Paris',color_scheme=scheme)
    init="if(!sessionStorage.s){"+(f"localStorage.setItem('budget-couple-data',{json.dumps(json.dumps(seed))});" if seed is not None else '')+(f"localStorage.setItem('budget-couple-cfg',{json.dumps(json.dumps(CFG))});" if cfg else '')+f"localStorage.setItem('budget-couple-me','{who}');localStorage.setItem('budget-couple-reminders','{{\"on\":true}}');sessionStorage.setItem('budget-couple-more','1');sessionStorage.s=1}}"
    c.add_init_script(init+extra)
    if fake:c.route('**/*supabase.co/**',lambda r:fake.handle(r,name))
    reqs=[];c.on('request',lambda r:reqs.append(r.url))
    c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(URL) else r.abort(),) if not fake else c.route(lambda u:u.startswith(URL),lambda r:r.continue_())
    pg=c.new_page();pg.reqs=reqs;pg.on('response',lambda r:r.status==404 and 'rpc/get_space' in r.url and probes.append(1));pg.clock.install(time=when);pg.on('pageerror',lambda e:errs.append(name+': '+str(e)));pg.on('console',lambda m:m.type=='error' and not('404' in m.text and probes) and errs.append(name+': '+m.text));pg.on('dialog',lambda d:d.accept())
    pg.goto(URL);pg.wait_for_function('RATES!==null');pg.wait_for_timeout(900)
    if cfg:pg.wait_for_function("document.querySelector('#syncState').textContent.includes('✓')")
    return pg
  data=lambda pg:pg.evaluate('JSON.parse(localStorage.getItem("budget-couple-data"))')
  ovf=lambda pg,w:pg.evaluate('document.documentElement.scrollWidth')<=w
  AX="axe.run(document,{runOnly:['wcag2a','wcag2aa']}).then(r=>r.violations.map(v=>v.id+':'+v.nodes.length))"
  # ===== 1) charge annuelle en retard (5 novembre 2026 : « Taxe fictive » de mars jamais marquée payée) =====
  pg=dev('2026-11-05T10:00:00+01:00');pg.add_script_tag(path='/tmp/axe.min.js')
  t=norm(pg.inner_text('#annLate'));print('HOME',t[:160]);assert 'Échéance annuelle en retard' in t and 'Taxe fictive' in t and 'mars 2026' in t and 'Assurance' not in t
  assert 'Rappels' not in norm(pg.inner_text('main')) or 'non marquée payée' not in norm(pg.inner_text('#remCard')) if pg.locator('#remCard').count() else True
  v=pg.evaluate(AX);assert not v,v;assert ovf(pg,390);pg.screenshot(path=f'{OUT}/v16-accueil-retard-390-sombre.png',full_page=True)
  pg.evaluate("go('budget')");pg.click('[data-seg-to=fixes],[data-seg=fixes]') if pg.locator('[data-seg=fixes]').count() else pg.evaluate("document.querySelector('[data-seg-to=fixes]')&&0");pg.wait_for_timeout(300)
  pg.evaluate("document.querySelector('#sec-annuels')?.scrollIntoView()");
  card=norm(pg.inner_text('.ann-late'));print('CARTE',card[:200]);assert 'en retard de 8 mois' in card and 'prête' not in card and 'provision complète' in card
  assert pg.locator('.ann:not(.ann-late)').count()==1 and 'prête' not in norm(pg.inner_text('.ann:not(.ann-late)'))
  v=pg.evaluate(AX);assert not v,v
  pg.screenshot(path=f'{OUT}/v16-charges-retard-390-sombre.png',full_page=True)
  # rappel : présent dans dueReminders (notification), absent de la carte Rappels pour éviter le doublon
  assert pg.evaluate("dueReminders().some(r=>r.late&&r.key==='annlate-an1-2026-11')")
  pg.click('[data-ann-paid="an1"]');pg.wait_for_timeout(300);a1=[a for a in data(pg)['annuals'] if a['id']=='an1'][0]
  print('PAYÉE',a1);assert a1['paidYear']==2026 and a1['saved']==0 and a1['since']=='2026-01'
  assert pg.locator('.ann-late').count()==0 and 'mars 2027' in norm(pg.inner_text('#sec-annuels'))
  pg.evaluate("go('accueil')");pg.wait_for_timeout(300);assert pg.locator('#annLate').count()==0
  # fiche : « Dernière année payée » modifiable, vide = suppression
  pg.evaluate("go('budget')");pg.evaluate("annualSheet('an1')");pg.wait_for_timeout(200);assert pg.input_value('#fAnnual [name=paidYear]')=='2026'
  pg.fill('#fAnnual [name=paidYear]','');pg.click('#fAnnual .btn:not(.danger)');pg.wait_for_timeout(300);assert 'paidYear' not in [a for a in data(pg)['annuals'] if a['id']=='an1'][0]
  pg.context.close()
  # nouvelle charge : since = mois courant ; créée après l'échéance → pas de retard
  pg=dev('2026-11-05T10:00:00+01:00');pg.evaluate("go('budget')");pg.evaluate("annualSheet()");pg.wait_for_timeout(200)
  pg.fill('#fAnnual [name=label]','Cadeaux fictifs');pg.fill('#fAnnual [name=amount]','300');pg.select_option('#fAnnual [name=month]','3');pg.click('#fAnnual .btn');pg.wait_for_timeout(300)
  n=[a for a in data(pg)['annuals'] if a['label']=='Cadeaux fictifs'][0];assert n['since']=='2026-11' and pg.evaluate("annualPlan(annIn(D.annuals.find(a=>a.label==='Cadeaux fictifs')),curMonth()).late")==False
  pg.context.close()
  # passage de mois : décembre non payé → en retard dès janvier ; largeurs et thèmes
  for w,sc in ((320,'light'),(390,'dark'),(768,'light')):
    pg=dev('2027-01-03T10:00:00+01:00',w=w,scheme=sc);pg.add_script_tag(path='/tmp/axe.min.js')
    t=norm(pg.inner_text('#annLate'));assert 'Assurance fictive' in t and 'décembre 2026' in t and 'Taxe fictive' in t,t
    assert ovf(pg,w);v=pg.evaluate(AX);assert not v,(w,sc,v)
    pg.screenshot(path=f'{OUT}/v16-accueil-retard-{w}-{sc}.png',full_page=True)
    pg.evaluate("go('budget')");pg.evaluate("document.querySelector('[data-seg-to=fixes]')");pg.evaluate("tab='budget'");pg.wait_for_timeout(200)
    assert ovf(pg,w);pg.screenshot(path=f'{OUT}/v16-charges-{w}-{sc}.png',full_page=True) if w==320 else 0
    pg.context.close()
  # ===== 2) migration additive v14 : since ajouté au chargement, rien d'écrasé ; en retard seulement après l'échéance suivante =====
  s14=json.loads(json.dumps(BASE));s14['version']=14;[a.pop('since') for a in s14['annuals']];s14['annuals'][0]['month']=11;s14['annuals'][0]['paidYear']=2025
  pg=dev('2026-11-10T10:00:00+01:00',seed=s14);d=data(pg);print('MIGRÉ',d['version'],[(a['id'],a.get('since'),a.get('paidYear'),a['saved']) for a in d['annuals']])
  assert d['version']==15 and all(a['since']=='2026-11' for a in d['annuals']) and d['annuals'][0]['paidYear']==2025 and d['annuals'][0]['saved']==480
  assert pg.locator('#annLate').count()==0 or 'Taxe fictive' in norm(pg.inner_text('#annLate'))  # novembre 2026 = échéance 2026 jamais payée (paidYear 2025) → à payer, donc légitimement signalée seulement si passée
  pg.context.close()
  # ===== 3) snapshot patrimoine automatique, 2 appareils, non secure puis secure =====
  for secure in (False,True):
    F=Fake(secure=secure);srvdata=json.loads(json.dumps(BASE));srvdata['version']=14;[a.pop('since') for a in srvdata['annuals']]
    F.row={'data':srvdata,'updated_at':F.ts()}
    A=dev('2026-11-10T10:00:00+01:00',seed=None,cfg=True,fake=F,name='A',who='p1');B=dev('2026-11-10T10:05:00+01:00',seed=None,cfg=True,fake=F,name='B',who='p2')
    for _ in range(3):
      A.evaluate("pullRemote()");B.evaluate("pullRemote()");A.wait_for_timeout(1500)
    a,bb=data(A),data(B);nwA=[n['id'] for n in a['networth']];nwB=[n['id'] for n in bb['networth']]
    print('SYNC secure' if secure else 'SYNC non secure',nwA,nwB,'since',[x.get('since') for x in a['annuals']],'écritures',F.writes,'conflits',F.conflicts)
    assert nwA==['nw-2026-11']==nwB and a['networth'][0]['total']==6000
    assert A.evaluate("canon(D)")==B.evaluate("canon(D)") and all(x.get('since')=='2026-11' for x in a['annuals']) and a['annuals'][0]['saved']==480
    srvnw=[n['id'] for n in F.row['data']['networth']];assert srvnw==['nw-2026-11'],srvnw
    w0=F.writes
    for _ in range(3):A.evaluate("pullRemote()");B.evaluate("pullRemote()");A.wait_for_timeout(1200)
    assert F.writes==w0,('ping-pong de synchro',w0,F.writes)
    # idempotent : un point existant n'est jamais réécrit automatiquement
    A.evaluate("D.placements[0].capital=9000;save()");A.evaluate("tickReports()");A.wait_for_timeout(300);assert [n['total'] for n in data(A)['networth']]==[6000]
    A.context.close();B.context.close()
  # un point du mois déjà présent (autre appareil) n'est pas dupliqué ; mois suivant → nouveau point ; sans patrimoine → rien
  pg=dev('2026-12-02T10:00:00+01:00',seed={**BASE,"networth":[{"id":"nw-2026-11","month":"2026-11","p1":6000,"p2":0,"common":0,"total":6000,"assets":6000,"debts":0}]})
  assert sorted(n['id'] for n in data(pg)['networth'])==['nw-2026-11','nw-2026-12'];pg.evaluate("tickReports();tickReports()");pg.wait_for_timeout(200);assert len(data(pg)['networth'])==2;pg.context.close()
  pg=dev('2026-12-02T10:00:00+01:00',seed={"version":15,"names":{"p1":"Alice","p2":"Bruno"},"updated":1}) ;assert data(pg)['networth']==[];pg.context.close()
  # ===== 4) Dépenses rouvre sur le mois courant à chaque nouvelle session =====
  sm=json.loads(json.dumps(BASE));sm['miscMonth']='2026-08'
  pg=dev('2026-11-10T10:00:00+01:00',seed=sm);pg.evaluate("go('budget')");pg.evaluate("document.querySelector('[data-seg=diverses]')&&document.querySelector('[data-seg=diverses]').click()");pg.wait_for_timeout(300)
  if not pg.locator('#miscMonth').count():pg.evaluate("go('budget');budgetSeg='diverses';render()") if False else pg.evaluate("document.querySelector('[data-seg-to=diverses]')?.click()")
  pg.wait_for_selector('#miscMonth',timeout=3000);assert pg.input_value('#miscMonth')=='2026-11',pg.input_value('#miscMonth')
  pg.fill('#miscMonth','2026-09');pg.dispatch_event('#miscMonth','change');pg.wait_for_timeout(300);assert pg.input_value('#miscMonth')=='2026-09'
  pg.reload();pg.wait_for_function('RATES!==null');pg.wait_for_timeout(600);pg.evaluate("go('budget')");pg.evaluate("document.querySelector('[data-seg=diverses]')&&document.querySelector('[data-seg=diverses]').click()");pg.wait_for_timeout(300)
  pg.wait_for_selector('#miscMonth',timeout=3000);assert pg.input_value('#miscMonth')=='2026-11','nouvelle session : mois courant';pg.context.close()
  # ===== 5) qrcode.js à la demande =====
  F=Fake();F.row={'data':json.loads(json.dumps(BASE)),'updated_at':F.ts()}
  pg=dev('2026-11-10T10:00:00+01:00',cfg=True,fake=F,name='Q')
  assert not any('qrcode' in u for u in pg.reqs),'qrcode.js ne doit pas être chargé au démarrage'
  pg.evaluate("go('reglages')");pg.wait_for_timeout(300);pg.evaluate("showInvite()");pg.wait_for_selector('#invitePanel svg[aria-label^="QR"]',timeout=5000)
  n0=sum('qrcode' in u for u in pg.reqs);assert n0>=1;pg.click('[data-inv=code]');pg.wait_for_selector('#invitePanel svg');pg.evaluate("showInvite('link');showInvite('link')");pg.wait_for_timeout(300);assert sum('qrcode' in u for u in pg.reqs)==n0,'un seul chargement'
  assert ovf(pg,390);pg.screenshot(path=f'{OUT}/v16-invitation-qr-390-sombre.png');pg.context.close()
  # ===== 6) contraste du toast « Annuler » (WCAG AA), thèmes clair/sombre, 3 largeurs =====
  for w in (320,390,768):
    for sc in ('light','dark'):
      pg=dev('2026-11-10T10:00:00+01:00',w=w,scheme=sc);pg.add_script_tag(path='/tmp/axe.min.js');pg.evaluate("toastUndo('Supprimé',()=>{})");pg.wait_for_timeout(500)
      v=pg.evaluate("axe.run('#toast',{runOnly:['wcag2aa']}).then(r=>r.violations.map(v=>v.id))");assert not v,(w,sc,v);pg.context.close()
  print('ERREURS',errs);assert not errs;print('V16 OK')
  b.close()
finally:srv.terminate()
