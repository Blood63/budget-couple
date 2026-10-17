"""Vérification des propositions externes : dates locales (minuit), recherche sans perte de focus, lien d'invitation masqué, plafonds PEA/livrets dans les conseils. Données fictives, réseau externe bloqué."""
import subprocess,time,json,os
from playwright.sync_api import sync_playwright
ROOT=os.path.join(os.path.dirname(__file__),'..','..');OUT=os.environ.get('OUT','/tmp')
srv=subprocess.Popen(['python3','-m','http.server','18768'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
CFG={"url":"https://exemple-fictif.supabase.co","key":"sb_publishable_FICTIF","space":"Exemple-espace-0000"}
D={"version":12,"names":{"p1":"Paul","p2":"Lucie"},"ratio":50,"births":{"p1":"1994-01-01","p2":"1996-01-01"},"tax":{"mode":"separe","children":0},
 "accounts":[{"id":"acc-joint","label":"Compte joint","owner":"joint"},{"id":"acc-p1","label":"Compte Paul","owner":"p1"}],"fixed":[],"incomes":[{"id":"i1","person":"p1","type":"salaire","label":"Salaire","amount":3000,"recurring":True},{"id":"i2","person":"p2","type":"salaire","label":"Salaire","amount":1800,"recurring":True}],"months":[],"goals":[],"debts":[],"transfer":{"amount":0},
 "placements":[{"id":"pea","type":"pea","name":"PEA Paul","owner":"p1","invested":149000,"monthly":100,"rate":5},{"id":"la","type":"livretA","name":"Livret A Paul","owner":"p1","capital":24000,"monthly":0,"rateMode":"auto"}],
 "valuations":[{"id":"v1","pid":"pea","date":"2026-10-01","value":160000}],
 "misc":[{"id":"x1","date":"2026-11-01","label":"Courses Leclerc","amount":42,"category":"courses","paidBy":"joint","for":"common","payer":"common"},{"id":"x2","date":"2026-11-02","label":"Cinéma Pathé","amount":18,"category":"loisirs","paidBy":"p1","for":"common","payer":"common"}]}
AX="axe.run(document,{runOnly:['wcag2a','wcag2aa']}).then(r=>r.violations.map(v=>v.id+':'+v.nodes.length))"
errs=[]
try:
 with sync_playwright() as p:
  b=p.chromium.launch();c=b.new_context(viewport={'width':390,'height':844},locale='fr-FR',timezone_id='Europe/Paris',permissions=['clipboard-read','clipboard-write'])
  c.add_init_script(f"if(!sessionStorage.s){{localStorage.setItem('budget-couple-data',{json.dumps(json.dumps(D))});localStorage.setItem('budget-couple-cfg',{json.dumps(json.dumps(CFG))});localStorage.setItem('budget-couple-me','p1');sessionStorage.s=1}}")
  c.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://localhost:18768') else r.abort())
  pg=c.new_page();pg.clock.install(time='2026-11-01T00:30:00+01:00');pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:m.type=='error' and 'Failed to fetch' not in m.text and 'ERR_FAILED' not in m.text and errs.append(m.text))
  pg.goto('http://localhost:18768/');pg.wait_for_function('RATES!==null');pg.wait_for_timeout(700);pg.add_script_tag(path='/tmp/axe.min.js')
  # 1) minuit local : 00h30 à Paris le 1er novembre (encore le 31 octobre en UTC)
  dates=pg.evaluate("[todayIso(),curMonth(),localIso(new Date('2026-10-31T23:30:00Z'))]");print('dates locales',dates);assert dates==['2026-11-01','2026-11','2026-11-01'],dates
  pg.evaluate("budgetSeg='diverses';go('budget')");pg.wait_for_timeout(500);pg.evaluate("miscSheet()");pg.wait_for_selector('#fMisc');assert pg.input_value('#fMisc [name=date]')=='2026-11-01';pg.evaluate("closeSheet()")
  # 3b) plafonds : PEA jugé sur les versements (149 000), pas sur la valorisation (160 000) ; livret au-delà du plafond par les intérêts
  K={t['key']:t for t in pg.evaluate('tips()')};print('plafonds',[k for k in K if k.startswith('ceil-')])
  assert 'ceil-near-pea' in K and 'ceil-full-pea' not in K and '150 000' in K['ceil-near-pea']['text'].replace(chr(0x202f),' ').replace(chr(0xa0),' ')
  assert 'ceil-full-la' in K and 'solde au plafond' in K['ceil-full-la']['title'] and 'intérêts capitalisés' in K['ceil-full-la']['text']
  # 5) recherche : frappe lente (> debounce), le focus et le texte restent, la liste se filtre
  pg.click('#miscQ');pg.keyboard.type('ciné',delay=220);pg.wait_for_timeout(400)
  assert pg.evaluate("document.activeElement.id")=='miscQ' and pg.input_value('#miscQ')=='ciné';assert pg.locator('.expense-item').count()==1;print('RECHERCHE debounce + focus OK')
  # 6) invitation masquée, copier/QR conservés
  pg.evaluate("go('reglages')");pg.wait_for_timeout(400);pg.click('#inviteBtn');pg.wait_for_selector('#inviteLink')
  assert pg.get_attribute('#inviteLink','type')=='password';assert pg.locator('.invite svg').count()>=1
  pg.click('#copyInv');pg.wait_for_timeout(300);clip=pg.evaluate("navigator.clipboard.readText()");assert clip==pg.evaluate("inviteLink()") and clip.startswith('https://blood63.github.io/budget-couple/#invite=');print('INVITATION masquée + copie OK')
  v=pg.evaluate(AX);print('AXE invitation',v);assert not v
  pg.evaluate("document.querySelector('#tabs').style.display='none'");pg.locator('.invite').screenshot(path=f'{OUT}/v12-invitation-masquee.png');pg.evaluate("document.querySelector('#tabs').style.display=''")
  b.close()
 assert not errs,errs;print('TEST GEMINI OK')
finally:srv.kill()
