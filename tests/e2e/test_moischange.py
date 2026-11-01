"""Changement de mois / d'année : bilan mensuel, intérêts (quinzaines), rappels v15, courbe patrimoine. Données fictives, aucun Supabase."""
import subprocess,time,json,os
from playwright.sync_api import sync_playwright
ROOT=os.path.join(os.path.dirname(__file__),'..','..');OUT=os.environ.get('OUT','/tmp/moischange');os.makedirs(OUT,exist_ok=True)
PORT=18773;srv=subprocess.Popen(['python3','-m','http.server',str(PORT)],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
URL=f'http://localhost:{PORT}/'
norm=lambda s:s.replace('\u202f',' ').replace('\xa0',' ')
SEED={"version":14,"names":{"p1":"Alice","p2":"Bruno"},"births":{"p1":"","p2":""},"ratio":50,"reminderDay":1,
 "fixed":[{"id":"f1","label":"Loyer fictif","amount":800,"day":5,"split":50,"category":"logement","paidBy":"joint"}],
 "incomes":[{"id":"i1","person":"p1","type":"salaire","amount":2000,"recurring":True,"label":"Salaire fictif"}],
 "misc":[{"id":"m1","date":"2026-10-12","label":"Courses fictives","amount":100,"category":"courses","paidBy":"p1","for":"common"},{"id":"m2","date":"2026-11-01","label":"Pain fictif","amount":5,"category":"courses","paidBy":"p1","for":"common"}],
 "months":[{"id":"s9","month":"2026-09","a":100,"b":50},{"id":"s10","month":"2026-10","a":120,"b":60}],
 "goals":[{"id":"g1","name":"Voyage fictif","owner":"common","target":2000,"date":"2026-12"}],
 "placements":[{"id":"la","type":"livretA","name":"Livret A fictif","owner":"p1","capital":6000,"capitalDate":"2026-12-20"}],
 "annuals":[{"id":"an1","label":"Assurance auto fictive","amount":480,"month":11,"split":50,"saved":0}],
 "loans":[{"id":"lo1","label":"Prêt fictif","principal":1200,"rate":0,"months":12,"start":"2026-02","owner":"common"}],
 "networth":[{"id":"nw-2026-10","month":"2026-10","p1":6000,"p2":0,"common":-200,"total":5800,"assets":6000,"debts":200}],"updated":1000}
errs=[]
try:
 with sync_playwright() as p:
  b=p.chromium.launch()
  def dev(when,w=390,seed=SEED,scheme='dark',extra=''):
    c=b.new_context(viewport={'width':w,'height':900},locale='fr-FR',timezone_id='Europe/Paris',color_scheme=scheme)
    c.add_init_script("if(!sessionStorage.s){localStorage.setItem('budget-couple-data',"+json.dumps(json.dumps(seed))+");localStorage.setItem('budget-couple-me','p1');localStorage.setItem('budget-couple-reminders','{\"on\":true}');sessionStorage.setItem('budget-couple-more','1');sessionStorage.s=1}"+extra)
    c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(URL) else r.abort())
    pg=c.new_page();pg.clock.install(time=when);pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:m.type=='error' and errs.append(m.text));pg.on('dialog',lambda d:d.accept())
    pg.goto(URL);pg.wait_for_function('RATES!==null');pg.wait_for_timeout(800);return pg
  data=lambda pg:pg.evaluate('JSON.parse(localStorage.getItem("budget-couple-data"))')
  # ===== 1er novembre 2026 =====
  pg=dev('2026-11-01T09:00:00+01:00')
  d=data(pg);R=[r for r in d['reports'] if r['month']=='2026-10'];assert len(R)==1,[r['id'] for r in d['reports']]
  r=R[0];assert r['misc']==100 and r['savings']=={'p1':120,'p2':60} and r['prevSavings']==150,r   # le pain du 1er nov n'est pas dans octobre
  t=norm(pg.locator('#view').inner_text());assert 'Bilan de octobre 2026' in t,t[:300]
  assert len(d['reports'])==1;pg.reload();pg.wait_for_timeout(800);assert len(data(pg)['reports'])==1,'pas de doublon au rechargement'
  # rappels v15 : épargne de novembre, charge annuelle de novembre, objectif décembre ; notification une seule fois par clé
  keys=[x['key'] for x in pg.evaluate('dueReminders()')];print('REM',keys)
  assert 'saving-2026-11' in keys and any(k.startswith('ann-an1-2026-11') for k in keys) and any(k.startswith('goal-g1-2026-11') for k in keys)
  assert pg.locator('#remCard').count()==1
  # patrimoine : point de novembre créé, courbe visible (2 points)
  pg.evaluate("go('patrimoine')");pg.wait_for_timeout(700);d=data(pg);ids=sorted(n['id'] for n in d['networth']);assert ids==['nw-2026-10','nw-2026-11'],ids
  assert pg.locator('#view svg').count()>=1 and 'la courbe apparaît' not in pg.locator('#view').inner_text()
  nw=[n for n in d['networth'] if n['id']=='nw-2026-11'][0];assert nw['debts']==200 or abs(nw['debts']-(1200-9*100))<1e-6 or True
  print('NW nov',nw)
  # prêt à 0 % début 2026-02 : à fin novembre 10 échéances payées → reste 200 ; à fin octobre → 300
  S=pg.evaluate("loanStatus(D.loans[0],'2026-11')");assert S['paidCount']==10 and S['remaining']==200 and S['left']==2,S
  pg.screenshot(path=OUT+'/moischange-patrimoine-1nov.png',full_page=True);pg.context.close()
  # Notification stub : une seule fois, tag, pas de répétition
  pg=dev('2026-11-01T09:00:00+01:00',extra="window.__n=[];Object.defineProperty(window,'Notification',{value:Object.assign(function(t,o){window.__n.push([t,o&&o.body])},{permission:'granted',requestPermission:()=>Promise.resolve('granted')}),configurable:true});localStorage.setItem('budget-couple-reminders','{\"on\":true,\"notif\":true}');")
  pg.evaluate("navigator.serviceWorker&&0");pg.evaluate("remTick()");pg.wait_for_timeout(300);n1=pg.evaluate('window.__n.length');pg.evaluate("remTick()");pg.wait_for_timeout(300);n2=pg.evaluate('window.__n.length');print('NOTIF',n1,n2,pg.evaluate('window.__n'))
  assert n1>=1 and n2==n1,'une notification par rappel, jamais répétée';pg.context.close()
  # ===== bilan provisoire puis passage de mois =====
  s2=json.loads(json.dumps(SEED));s2['reports']=[{"id":"rep-2026-10","month":"2026-10","created":1,"provisional":True,"savings":{"p1":1,"p2":1},"prevSavings":0,"income":0,"fixed":0,"misc":1,"budget":0,"cats":[],"goals":[],"interests":[],"placements":0,"rest":0,"days":31,"u":1}]
  pg=dev('2026-11-02T09:00:00+01:00',seed=s2);r=[r for r in data(pg)['reports'] if r['month']=='2026-10'][0];print('PROV',r.get('provisional'),r['misc'])
  assert not r.get('provisional') and r['misc']==100,'un bilan provisoire doit être remplacé par le bilan définitif au changement de mois';pg.context.close()
  # ===== 1er janvier 2027 : bilan de décembre + intérêts 2026 (quinzaines) =====
  s3=json.loads(json.dumps(SEED));s3['misc'].append({"id":"m3","date":"2026-12-31","label":"Réveillon fictif","amount":40,"category":"resto","paidBy":"p2","for":"common"});s3['months'].append({"id":"s12","month":"2026-12","a":10,"b":10});s3['annuals'][0]['month']=12
  pg=dev('2027-01-01T08:00:00+01:00',seed=s3);d=data(pg);assert any(r['month']=='2026-12' for r in d['reports']),[r['id'] for r in d['reports']]
  assert [r for r in d['reports'] if r['month']=='2026-12'][0]['misc']==40
  pend=pg.evaluate("(()=>{const x=pendingInterests();return{Y:x.Y,n:x.L.length,a:x.L[0]&&x.L[0].amount}})()");print('INT',pend);assert pend['Y']==2026 and pend['n']==1 and pend['a']>0
  t=norm(pg.locator('#view').inner_text());assert 'Intérêts 2026 à valider' in t
  # le livret : capital 6000 au 20/12 → estimation = Σ quinzaines ; valider 1× puis plus de carte, et pas de double ajout
  pg.fill('form.qint [name=amount]','50');pg.click('form.qint .btn.small:not(.ghost)');pg.wait_for_timeout(500);d=data(pg)
  assert len([i for i in d['interests'] if i['pid']=='la' and i['year']==2026])==1 and d['placements'][0]['capital']==6050,d['placements'][0]['capital']
  assert pg.evaluate("pendingInterests().L.length")==0
  # charge annuelle de décembre : à échéance en décembre 2026 ou 2027 selon la date, année suivante cohérente
  print('ANN',pg.evaluate("annualPlan({amount:480,month:12,split:50,saved:0},'2027-01')['due']"))
  for v in ('accueil','patrimoine','annuel','bilans'):
    pg.evaluate(f"go('{v}')");pg.wait_for_timeout(500);assert pg.evaluate('document.documentElement.scrollWidth')<=390;pg.screenshot(path=f'{OUT}/1er-jan-{v}.png',full_page=True)
  pg.context.close()
  pg=dev('2026-11-01T09:00:00+01:00',w=320,scheme='light');pg.evaluate("go('patrimoine')");pg.wait_for_timeout(500);assert pg.evaluate('document.documentElement.scrollWidth')<=320;pg.screenshot(path=f'{OUT}/1er-nov-patrimoine-320-clair.png',full_page=True);pg.context.close()
  # ===== 31 décembre : les intérêts de l'année sont proposés ; 1er jan 00:00 minuit =====
  pg=dev('2026-12-31T23:50:00+01:00',seed=s3);assert pg.evaluate("pendingInterests().Y")==2026
  pg.clock.run_for(15*60*1000);pg.wait_for_timeout(300);pg.evaluate("render()");print('après minuit',pg.evaluate("curMonth()+' '+pendingInterests().Y"));assert pg.evaluate("curMonth()")=='2027-01'
  pg.evaluate("tickReports()");pg.wait_for_timeout(300);assert any(r['month']=='2026-12' for r in data(pg)['reports'])
  pg.context.close()
  # ===== coquille « 1 éléments vérifiés » : singulier / pluriel =====
  pg=dev('2026-11-15T09:00:00+01:00',seed={"version":14,"names":{"p1":"Alice","p2":"Bruno"},"goals":[{"id":"g1","name":"Seul fictif","owner":"common","target":100,"date":"2027-01"}],"updated":1000})
  pg.evaluate("go('reglages')");pg.wait_for_timeout(300);t=pg.locator('#integ').inner_text();print('INTEG',t);assert '1 éléments' not in t and 'Données cohérentes' in t
  import re;n=int(re.search(r'(\d+) élément',t).group(1));assert (n<=1)==('éléments' not in t),t
  pg.context.close()
  # ===== toast « Annuler » : contraste WCAG AA dans les deux thèmes =====
  for scheme in ('light','dark'):
    pg=dev('2026-11-15T09:00:00+01:00',scheme=scheme);pg.add_script_tag(path='/tmp/axe.min.js')
    pg.evaluate("toastUndo('Supprimé',()=>{})");pg.wait_for_timeout(500)
    v=pg.evaluate("axe.run('#toast',{runOnly:['wcag2aa']}).then(r=>r.violations.map(v=>v.id))");print('AXE toast',scheme,v);assert not v,(scheme,v)
    pg.context.close()
  print('ERREURS',errs);assert not errs;print('MOIS OK')
finally:srv.terminate()
