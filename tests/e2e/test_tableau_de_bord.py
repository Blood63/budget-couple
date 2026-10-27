import subprocess,time,json,sys
sys.path.insert(0,__import__('os').path.dirname(__file__));from fake_supabase import Fake
from playwright.sync_api import sync_playwright
srv=subprocess.Popen(['python3','-m','http.server','18765'],cwd=__import__('os').path.join(__import__('os').path.dirname(__file__),'..','..'),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
errs=[]
import datetime;cm=datetime.date.today().strftime('%Y-%m');pm=(datetime.date.today().replace(day=1)-datetime.timedelta(days=1)).strftime('%Y-%m')
V3={"version":3,"names":{"p1":"Emilien","p2":"Julie"},"ratio":55,
 "months":[{"id":f"m{i}","month":mo,"a":a,"b":b} for i,(mo,a,b) in enumerate([("2026-04",300,250),("2026-05",320,260),("2026-06",280,240),("2026-07",350,300),("2026-08",400,300),(pm,380,320)])],
 "goals":[{"id":"g1","name":"Voyage (exemple)","owner":"common","target":6000,"saved":800,"date":"2028-04"},{"id":"g2","name":"Voiture (exemple)","owner":"p1","target":4000,"saved":300,"date":"2027-10"},{"id":"g3","name":"Formation (exemple)","owner":"p2","target":900,"saved":100,"date":"2027-06"}],
 "fixed":[{"id":"f1","label":"Loyer (exemple)","amount":950,"day":5,"split":55},{"id":"f2","label":"Électricité (exemple)","amount":75,"day":14,"split":50},{"id":"f3","label":"Internet (exemple)","amount":30,"day":20,"split":50},{"id":"f4","label":"Assurance auto (exemple)","amount":48,"day":10,"split":100},{"id":"f5","label":"Mutuelle J. (exemple)","amount":40,"day":28,"split":0}],
 "transfer":{"from":"p2","amount":420,"label":"Virement loyer"},"budget":{cm:450},
 "incomes":[{"id":"i1","person":"p1","type":"salaire","label":"Salaire (exemple)","amount":2300,"recurring":True},{"id":"i2","person":"p2","type":"salaire","label":"Salaire (exemple)","amount":2100,"recurring":True}],
 "misc":[],"placements":[{"id":"pl1","name":"Livret (exemple)","owner":"common","capital":2500,"monthly":150,"rate":3}],"updated":1000}
with sync_playwright() as p:
  b=p.chromium.launch()
  c=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True,locale='fr-FR')
  c.add_init_script("sessionStorage.setItem('budget-couple-more','1')");c.add_init_script(f"if(!sessionStorage.s){{localStorage.setItem('budget-couple-data',{json.dumps(json.dumps(V3))});sessionStorage.s=1}}")
  pg=c.new_page();pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:m.type=='error' and errs.append(m.text));pg.on('dialog',lambda d:d.accept())
  pg.goto('http://localhost:18765/');pg.wait_for_timeout(900)
  d=pg.evaluate('D');assert d['version']==14 and d['fixed'][0]['category']=='autre' and d['fixed'][0]['paidBy']=='joint';print('MIGRATION v3→v4 OK')
  # choix de la personne au premier lancement
  assert pg.is_visible('#sheet .who');pg.click('[data-me=p1]');pg.wait_for_timeout(300)
  # catégories et payeur réel des charges
  pg.evaluate("""D.fixed.forEach(f=>{f.category={f1:'logement',f2:'energie',f3:'abonnement',f4:'assurance',f5:'sante'}[f.id];f.paidBy={f1:'p1',f4:'p1',f5:'p2'}[f.id]||'joint'});save()""")
  # saisie rapide x4
  for amt,cat,paid,forw,lab in [('64,20','courses','p1','common','Marché (exemple)'),('38','resto','p2','common','Pizzeria (exemple)'),('25','loisirs','p1','p2','Cinéma J. (exemple)'),('112,5','courses','joint','common','Supermarché (exemple)')]:
    pg.click('#quickAdd');pg.wait_for_timeout(300);pg.fill('.amount-in',amt)
    for n,v in [('category',cat),('paidBy',paid),('for',forw)]:pg.check(f'#fMisc [name={n}][value={v}]',force=True)
    pg.fill('#fMisc [name=label]',lab);pg.click('#fMisc .btn');pg.wait_for_timeout(300);pg.click('[data-tab=accueil]') if not pg.is_visible('#quickAdd') else None
  bal=pg.evaluate(f'balance("{cm}")');print('ÉQUILIBRE',bal['net'])
  # attendu : loyer payé par E : J doit 950*.45=427.5 ; assurance E 100% → 0 ; mutuelle J 0/100 → 0 ; marché E commun : 64.2*.45=28.89 ; pizzeria J : E doit 38*.55=20.9 ; cinéma E pour J : 25 ; transfert J→E 420
  exp=427.5+28.89-20.9+25-420;assert abs(bal['net']-exp)<0.01,(bal['net'],exp)
  pg.click('[data-tab=accueil]');pg.wait_for_timeout(1300);pg.screenshot(path='/tmp/v3-1-accueil.png')
  pg.evaluate("scrollTo(0,700)");pg.wait_for_timeout(400);pg.screenshot(path='/tmp/v3-2-accueil-suite.png');pg.evaluate("scrollTo(0,0)")
  pg.click('#quickAdd');pg.wait_for_timeout(400);pg.fill('.amount-in','18,90');pg.screenshot(path='/tmp/v3-3-saisie-rapide.png');pg.keyboard.press('Escape');pg.wait_for_timeout(300)
  # réglement
  pg.click('#settle');pg.wait_for_timeout(300);assert abs(pg.evaluate(f'balance("{cm}").net'))<0.01;print('RÈGLEMENT OK')
  pg.click('[data-tab=budget]');pg.click('[data-seg=fixes]');pg.wait_for_timeout(1200);pg.evaluate("document.querySelector('.donut-w').scrollIntoView({block:'center'})");pg.wait_for_timeout(300);pg.screenshot(path='/tmp/v3-4-charges-categories.png')
  pg.fill('#fixQ','loyer');pg.wait_for_timeout(200);assert pg.locator('[data-edit-fixed]').count()==1 and pg.evaluate("document.activeElement.id")=='fixQ';pg.fill('#fixQ','');print('RECHERCHE OK')
  pg.select_option('#fixCat','energie');assert pg.locator('[data-edit-fixed]').count()==1;pg.select_option('#fixCat','')
  pg.click('[data-seg=diverses]');pg.wait_for_timeout(1200);pg.screenshot(path='/tmp/v3-5-depenses.png')
  pg.select_option('#miscCat','courses');assert pg.locator('[data-del-misc]').count()==2;pg.select_option('#miscWho','p1');assert pg.locator('[data-del-misc]').count()==1;print('FILTRES OK')
  pg.select_option('#miscCat','');pg.select_option('#miscWho','')
  pg.click('[data-seg=revenus]');pg.wait_for_timeout(1000);pg.screenshot(path='/tmp/v3-6-revenus.png')
  pg.click('[data-tab=epargne]');pg.wait_for_timeout(1200);pg.screenshot(path='/tmp/v3-7-epargne.png')
  pg.click('[data-tab=objectifs]');pg.wait_for_timeout(1200);pg.screenshot(path='/tmp/v3-8-objectifs.png')
  pg.goto('http://localhost:18765/');pg.wait_for_timeout(600);pg.click('#gear');pg.wait_for_timeout(400);pg.focus('#openHist');pg.keyboard.press('Enter');pg.wait_for_timeout(600);pg.screenshot(path='/tmp/v3-9-historique.png')
  n=pg.locator('#view .list .item').count();pg.check('[name=histWho][value=p2]',force=True);pg.wait_for_timeout(200);print('HISTORIQUE',n,'→ filtre Julie',pg.locator('#view .list .item').count())
  # accessibilité : axe-core
  pg.add_script_tag(url='https://cdn.jsdelivr.net/npm/axe-core@4/axe.min.js')
  for t in ['accueil','budget','epargne','objectifs','placements']:
    pg.click(f'[data-tab={t}]');pg.wait_for_timeout(1100)
    r=pg.evaluate("axe.run(document,{runOnly:['wcag2a','wcag2aa']}).then(r=>r.violations.map(v=>v.id+':'+v.nodes.length))");print('AXE',t,r)
  # clavier : flèches dans la barre d'onglets
  pg.focus('#tab-accueil');pg.keyboard.press('ArrowRight');assert pg.evaluate('tab')=='budget';print('CLAVIER OK')
  b.close()
srv.terminate();print('ERREURS:',errs)
