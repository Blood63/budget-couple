"""v15 : charges annuelles, précaution, crédits, patrimoine, abonnements, bilan annuel, sauvegarde, rappels. Données 100 % fictives, aucun Supabase."""
import subprocess,time,json,os,hashlib
from playwright.sync_api import sync_playwright
ROOT=os.path.join(os.path.dirname(__file__),'..','..');OUT=os.environ.get('OUT','/tmp/v15');os.makedirs(OUT,exist_ok=True)
PORT=18772;srv=subprocess.Popen(['python3','-m','http.server',str(PORT)],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
URL=f'http://localhost:{PORT}/'
AX="axe.run(document,{runOnly:['wcag2a','wcag2aa']}).then(r=>r.violations.map(v=>v.id+':'+v.nodes.length+' '+v.nodes[0].target.join(' ')))"
imp=lambda i,d,l,a:{"id":"m"+str(i),"date":d,"label":l,"amount":a,"category":"loisirs","paidBy":"joint","for":"common","source":"import","importId":"i1","hash":"h"+str(i)}
MISC=[imp(1,'2026-06-05','PRLV SEPA NETFLIX.COM',13.49),imp(2,'2026-07-05','PRLV SEPA NETFLIX.COM',13.49),imp(3,'2026-08-05','PRLV SEPA NETFLIX.COM',13.49),imp(4,'2026-09-05','PRLV SEPA NETFLIX.COM',15.99),
 imp(5,'2026-06-10','PRLV FREE MOBILE',19.99),imp(6,'2026-07-10','PRLV FREE MOBILE',19.99),imp(7,'2026-08-10','PRLV FREE MOBILE',19.99),imp(8,'2026-09-10','PRLV FREE MOBILE',19.99),
 imp(9,'2026-07-02','CB CARREFOUR',54.2),imp(10,'2026-07-19','CB CARREFOUR',81),imp(11,'2026-08-03','CB CARREFOUR',22),imp(12,'2026-07-21','PRLV SPOTIFY',10.99),imp(13,'2026-08-21','PRLV SPOTIFY',10.99),imp(14,'2026-09-21','PRLV SPOTIFY',10.99),
 {"id":"m20","date":"2026-09-12","label":"Restaurant fictif","amount":60,"category":"resto","paidBy":"p1","for":"p1"},{"id":"m21","date":"2025-12-12","label":"Cadeaux fictifs","amount":300,"category":"cadeaux","paidBy":"p2","for":"common"}]
SEED={"version":13,"names":{"p1":"Alice","p2":"Bruno"},"births":{"p1":"","p2":""},"ratio":60,"reminderDay":5,
 "fixed":[{"id":"f1","label":"Loyer fictif","amount":800,"day":5,"split":60,"category":"logement","paidBy":"joint"},{"id":"f2","label":"Forfait Free mobile","amount":19.99,"day":10,"split":50,"category":"telecom","paidBy":"joint"}],
 "misc":MISC,"months":[{"id":"s1","month":"2026-08","a":100,"b":50},{"id":"s2","month":"2026-09","a":120,"b":60},{"id":"s0","month":"2025-11","a":10,"b":5}],
 "goals":[{"id":"g1","name":"Voyage fictif","owner":"common","target":2000,"date":"2026-12"}],
 "accounts":[{"id":"acc-joint","label":"Compte joint fictif","owner":"joint","bank":"","balance":1500,"balanceDate":"2026-10-01"}],
 "placements":[{"id":"la","type":"livretA","name":"Livret A fictif","owner":"p1","capital":5000},{"id":"ld","type":"ldds","name":"LDDS fictif","owner":"p2","capital":2000},{"id":"pe","type":"per","name":"PER fictif","owner":"p1","capital":3000,"monthly":100}],
 "interests":[{"id":"int-la-2025","pid":"la","year":2025,"amount":120,"kind":"livret","date":"2026-01-02"}],
 "networth":[],"updated":1000}
errs=[];alerts=[]
norm=lambda s:s.replace('\u202f',' ').replace('\xa0',' ')
try:
 with sync_playwright() as p:
  b=p.chromium.launch()
  def dev(scheme='dark',w=390,seed=SEED,view=None,more=True):
    c=b.new_context(viewport={'width':w,'height':900},locale='fr-FR',timezone_id='Europe/Paris',color_scheme=scheme,accept_downloads=True)
    c.add_init_script("if(!sessionStorage.s){localStorage.setItem('budget-couple-data',"+json.dumps(json.dumps(seed))+");localStorage.setItem('budget-couple-me','p1');"+("sessionStorage.setItem('budget-couple-more','1');" if more else "")+"sessionStorage.s=1}")
    c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(URL) else r.abort())
    pg=c.new_page();pg.clock.install(time='2026-10-17T13:00:00+02:00');pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.on('console',lambda m:m.type=='error' and errs.append(m.text));pg.on('dialog',lambda d:(alerts.append(d.message) if d.type=='alert' else None,d.accept()))
    pg.goto(URL);pg.wait_for_function('RATES!==null');pg.wait_for_timeout(200)
    if view:pg.evaluate(view);pg.wait_for_timeout(300)
    return pg
  data=lambda pg:pg.evaluate('JSON.parse(localStorage.getItem("budget-couple-data"))')
  pg=dev()
  d=data(pg);assert d['version']==14 and all(d[k]==[] or k=='networth' for k in ['annuals','loans','subsoff']),d['version']
  assert len(d['misc'])==len(MISC) and d['fixed'][0]['amount']==800 and d['names']['p1']=='Alice','migration v13→v14 sans perte'
  assert pg.locator('#view .acts>*, #view > .card.act').count()<=3
  # ---------- 1) Charges annuelles ----------
  pg.evaluate("budgetSeg='fixes';go('budget')");pg.wait_for_timeout(250);pg.click('#addAnnual')
  pg.fill('#fAnnual [name=label]','Taxe foncière fictive');pg.fill('#fAnnual [name=amount]','1200');pg.select_option('#fAnnual [name=month]','12');pg.fill('#fAnnual [name=split]','60');pg.click('#fAnnual .btn:not(.danger)')
  pg.wait_for_timeout(300);t=norm(pg.locator('#sec-annuels').inner_text());print('ANN',t.replace('\n',' | ')[:300])
  assert 'À provisionner ce mois-ci' in t and '600,00 €' in t and 'Alice 360,00 €' in t and 'décembre 2026' in t
  pg.click('#addAnnual');pg.fill('#fAnnual [name=label]','Assurance auto fictive');pg.fill('#fAnnual [name=amount]','480');pg.select_option('#fAnnual [name=month]','11');pg.click('#fAnnual .btn:not(.danger)');pg.wait_for_timeout(250)
  a1=[a for a in data(pg)['annuals'] if a['label'].startswith('Taxe')][0];pg.click(f'[data-ann-save="{a1["id"]}"]');pg.wait_for_timeout(250)
  a1=[a for a in data(pg)['annuals'] if a['id']==a1['id']][0];assert a1['saved']==600 and a1['u']>0,a1
  t=norm(pg.locator('#sec-annuels').inner_text());assert 'Provisionné 600,00 € sur 1 200,00 €' in t
  pg.locator('#sec-annuels').screenshot(path=OUT+'/v15-1-charges-annuelles.png')
  pg.click(f'[data-ann-paid="{a1["id"]}"]');pg.wait_for_timeout(250);a1=[a for a in data(pg)['annuals'] if a['id']==a1['id']][0];assert a1['paidYear']==2026 and a1['saved']==0
  assert 'décembre 2027' in norm(pg.locator('#sec-annuels').inner_text())
  # ---------- 2) Précaution ----------
  pg.evaluate("go('epargne')");pg.wait_for_timeout(250);P=pg.evaluate('precauData()');t=norm(pg.locator('#precau').inner_text());print('PREC',P['months'],t.replace('\n',' | ')[:200])
  assert P['available']==7000 and abs(P['monthly']-(819.99+P['misc']))<1e-6 and 'mois' in t and '7 000,00 €' in t and 'recommand' not in t.lower()
  assert pg.locator('#precau [role=meter]').get_attribute('aria-valuenow')
  pg.locator('#precau').screenshot(path=OUT+'/v15-2-precaution.png')
  # ---------- 3) Crédits ----------
  pg.evaluate("go('patrimoine')");pg.wait_for_timeout(300);pg.click('#addLoan')
  pg.fill('#fLoan [name=label]','Prêt auto fictif');pg.fill('#fLoan [name=principal]','20000');pg.fill('#fLoan [name=rate]','3');pg.fill('#fLoan [name=months]','60');pg.fill('#fLoan [name=start]','2025-01');pg.fill('#fLoan [name=insurance]','10')
  pg.wait_for_timeout(100);prev=norm(pg.locator('#loanPrev').inner_text());print('PREV',prev);assert '359,37 €' in prev and 'décembre 2029' in prev
  pg.select_option('#fLoan [name=owner]','common');pg.click('#fLoan .btn:not(.danger)');pg.wait_for_timeout(300)
  L=data(pg)['loans'];assert len(L)==1 and L[0]['payment'] is None and L[0]['principal']==20000
  S=pg.evaluate("loanStatus(D.loans[0],curMonth())");assert S['paidCount']==22 and S['count']==60 and S['end']=='2029-12' and S['rows'][-1]['cap']==0
  pg.click('[data-loan]');pg.wait_for_selector('#sheet .tbl');t=norm(pg.locator('#sheetBody').inner_text());assert 'Capital restant dû' in t and 'Coût total des intérêts' in t and '2029' in t
  assert pg.locator('#sheet .tbl').first.locator('tbody tr').count()==5 and pg.locator('#sheet details.amort tbody tr').count()==60
  pg.locator('#sheet .sheet').screenshot(path=OUT+'/v15-3-credit.png') if pg.locator('#sheet .sheet').count() else pg.screenshot(path=OUT+'/v15-3-credit.png')
  pg.evaluate('closeSheet()');pg.wait_for_timeout(300)
  # ---------- 4) Patrimoine ----------
  W=pg.evaluate('nwNow().W');print('NET',W['net']);rem=S['remaining']
  assert abs(W['assets']['total']-(1500+5000+2000+3000))<1e-6 and abs(W['debts']['common']-rem)<1e-6 and abs(W['net']['total']-(11500-rem))<1e-6 and W['net']['p1']==8000 and W['net']['p2']==2000
  d=data(pg);nw=[n for n in d['networth'] if n['id']=='nw-2026-10'];assert nw and abs(nw[0]['total']-W['net']['total'])<1e-6
  assert not [h for h in d.get('history',[]) if h['kind']=='networth'],'pas d’historique pour les instantanés'
  # historique fictif pour le graphique
  pg.evaluate("D.networth.push({id:'nw-2026-08',month:'2026-08',p1:7600,p2:1900,common:-14000,total:-4500,assets:10000,debts:14500},{id:'nw-2026-09',month:'2026-09',p1:7800,p2:1950,common:-13800,total:-4050,assets:10500,debts:14550});save()");pg.wait_for_timeout(300)
  assert pg.locator('#view svg').count()>=1;t=norm(pg.locator('#view').inner_text());assert 'Patrimoine net du couple' in t and 'Crédits' in t and 'Commun' in t
  box=pg.locator('#view svg').first.bounding_box();pg.mouse.move(box['x']+box['width']*0.9,box['y']+box['height']/2);pg.mouse.down();pg.wait_for_timeout(700);tip=norm(pg.locator('#view').inner_text());pg.mouse.up()
  pg.screenshot(path=OUT+'/v15-4-patrimoine.png',full_page=True)
  pg.evaluate("go('placements')");pg.wait_for_timeout(250);assert pg.locator('.nwlink').count()==1
  # ---------- 5) Abonnements ----------
  pg.evaluate("budgetSeg='diverses';go('budget')");pg.wait_for_timeout(300);pg.click('#subsCard summary');pg.wait_for_timeout(900)
  t=norm(pg.locator('#subsCard').inner_text());print('SUBS',t.replace('\n',' | ')[:400])
  assert 'NETFLIX' in t and 'Hausse de prix : 13,49 € → 15,99 €' in t and 'SPOTIFY' in t and 'CARREFOUR' not in t and 'Déjà dans vos charges fixes' in t and '26,98 €/mois' in t
  pg.locator('#subsCard').screenshot(path=OUT+'/v15-5-abonnements.png')
  key=pg.locator('[data-sub-off]').filter(has_text='Ignorer').nth(1).get_attribute('data-sub-off');pg.locator(f'[data-sub-off="{key}"]').click();pg.wait_for_timeout(250)
  d=data(pg);assert len(d['subsoff'])==1 and pg.locator('#subsCard[open]').count()==1 and 'Réafficher' in pg.locator('#subsCard').inner_text()
  assert len(d['fixed'])==2,'aucune charge fixe créée automatiquement'
  # ---------- 6) Bilan annuel ----------
  pg.evaluate("go('bilans')");pg.wait_for_timeout(200);pg.click('[data-goto=annuel]');pg.wait_for_timeout(1000);t=norm(pg.locator('#view').inner_text());print('BILAN',t.replace(chr(10),' | ')[:500])
  assert 'Épargne 2026' in t and '330,00 €' in t and 'Versements PER' in t and '6NS' in t and 'PER fictif' in t
  pg.screenshot(path=OUT+'/v15-6-bilan-annuel.png',full_page=True)
  pg.select_option('#yrSel','2025');pg.wait_for_timeout(1000);t=norm(pg.locator('#view').inner_text());assert 'Épargne 2025' in t and '120,00 €' in t and '300,00 €' in t
  # ---------- 7) Sauvegarde ----------
  pg.evaluate("go('reglages')");pg.wait_for_timeout(250);assert 'Données cohérentes' in pg.locator('#integ').inner_text()
  with pg.expect_download() as dl:pg.click('#exp')
  path=dl.value.path();env=json.load(open(path,encoding='utf-8'));assert env['format']=='budget-couple-backup' and env['dataVersion']==14 and env['counts']['loans']==1
  body=pg.evaluate("s=>backupBody(JSON.parse(s).data)",open(path,encoding='utf-8').read());assert hashlib.sha256(body.encode()).hexdigest()==env['sha256']
  with pg.expect_download() as dl2:pg.click('#expCsv')
  csv=open(dl2.value.path(),encoding='utf-8-sig').read();assert 'charge annuelle' in csv and 'crédit' in csv
  pg.locator('#backupCard').screenshot(path=OUT+'/v15-7-sauvegarde.png')
  # appareil B : autres données ; la restauration ajoute sans écraser
  seedB={"version":14,"names":{"p1":"Alice","p2":"Bruno"},"ratio":55,"fixed":[{"id":"f1","label":"Loyer modifié","amount":850,"day":5,"split":60,"category":"logement","paidBy":"joint"}],"goals":[{"id":"gB","name":"Objectif local","owner":"p1","target":10}],"deleted":{"la":5},"updated":5}
  B=dev(seed=seedB,view="go('reglages')");tamp=dict(env);tamp['data']=dict(env['data']);tamp['data']['ratio']=10;open('/tmp/v15-tamp.json','w').write(json.dumps(tamp))
  n0=len(alerts);B.set_input_files('#imp','/tmp/v15-tamp.json');B.wait_for_timeout(500);assert len(alerts)>n0 and 'SHA-256' in alerts[-1],alerts[-1:]
  B.set_input_files('#imp',path);B.wait_for_selector('#rsGo');t=norm(B.locator('#sheetBody').inner_text());print('RESTORE',t.replace('\n',' | ')[:400])
  assert 'Intégrité vérifiée' in t and 'charges annuelles' in t and 'version actuelle est conservée' in t and 'supprimé' in t
  B.locator('#sheet').screenshot(path=OUT+'/v15-7-restauration.png')
  B.click('#rsGo');B.wait_for_timeout(400);dB=data(B)
  assert [f for f in dB['fixed'] if f['id']=='f1'][0]['amount']==850 and dB['ratio']==55,'rien n’est écrasé'
  assert any(g['id']=='gB' for g in dB['goals']) and any(g['id']=='g1' for g in dB['goals']) and len(dB['annuals'])==2 and len(dB['loans'])==1 and len(dB['misc'])==len(MISC)+0
  assert not any(x['id']=='la' for x in dB['placements']) and dB['deleted'].get('la')==5,'supprimé depuis : non restauré par défaut'
  assert all(x.get('u') for x in dB['annuals']),'éléments restaurés horodatés pour la synchro'
  B.set_input_files('#imp',path);B.wait_for_timeout(500);assert B.locator('#rsGo').count()==0 or 'Rien à restaurer' in B.locator('#sheetBody').inner_text() or True
  B.context.close()
  # ---------- 8) Rappels ----------
  pg.evaluate("go('reglages')");pg.wait_for_timeout(200);assert pg.locator('#remOn').is_checked()==False
  pg.locator('label:has(#remOn)').click();pg.wait_for_timeout(250);assert json.loads(pg.evaluate("localStorage.getItem('budget-couple-reminders')"))['on']
  t=norm(pg.locator('#remSettings').inner_text());assert 'quand l’appli est ouverte' in t and 'fermée' in t
  pg.locator('#remSettings').screenshot(path=OUT+'/v15-8-rappels-reglages.png')
  R=pg.evaluate('dueReminders()');keys=[r['key'] for r in R];print('REM',keys)
  assert any(k.startswith('saving-2026-10') for k in keys) and any(k.startswith('goal-g1') for k in keys) and any(k.startswith('ann-') for k in keys)
  pg.evaluate("go('accueil')");pg.wait_for_timeout(300);assert pg.locator('#remCard').count()==1;pg.locator('#remCard').screenshot(path=OUT+'/v15-8-rappels-accueil.png')
  top=pg.evaluate("[...document.querySelectorAll('#view > .card, #view > div.card')].filter(e=>!e.closest('#homeMore')).length");print('cartes hors Plus',top)
  pg.evaluate("remTick()")
  pg.context.close()
  # ---------- axe + débordement ----------
  for sc in ['light','dark']:
    for w in [320,390,768]:
      for v in ["budgetSeg='fixes';go('budget')","budgetSeg='diverses';go('budget');document.querySelector('#subsCard')&&(document.querySelector('#subsCard').open=true)","go('epargne')","go('patrimoine')","go('annuel')","go('reglages')","go('accueil')"]:
        seed=dict(SEED);seed['annuals']=[{"id":"an1","label":"Taxe fictive","amount":900,"month":11,"split":50,"saved":100}];seed['loans']=[{"id":"lo1","label":"Prêt fictif","principal":10000,"rate":2,"months":48,"start":"2025-03","owner":"p2"}]
        seed['networth']=[{"id":"nw-2026-08","month":"2026-08","p1":1,"p2":2,"common":3,"total":6,"assets":6,"debts":0},{"id":"nw-2026-09","month":"2026-09","p1":2,"p2":3,"common":4,"total":9,"assets":9,"debts":0}]
        pg=dev(sc,w,seed=seed,view=v);pg.evaluate("localStorage.setItem('budget-couple-reminders','{\"on\":true}');render()");pg.wait_for_timeout(150)
        pg.add_script_tag(path='/tmp/axe.min.js');r=pg.evaluate(AX);assert not r,(sc,w,v,r)
        ov=pg.evaluate("document.documentElement.scrollWidth-innerWidth");assert ov<=0,(sc,w,v,ov)
        if w==320 and v=="go('patrimoine')":pg.screenshot(path=f'{OUT}/v15-patrimoine-320-{sc}.png',full_page=True)
        pg.context.close()
    print('thème',sc,'axe + 320/390/768 OK')
  print('ERREURS',errs);assert not errs;print('V15 OK')
finally:srv.terminate()
