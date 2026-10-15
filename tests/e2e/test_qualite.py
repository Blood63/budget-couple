"""Indicateur de qualité : assurances (note, critères, garanties manquantes) et contrats AV/PEA (préremplissage, frais sur 10 ans, mentions), migration v9→v10, axe."""
import subprocess,time,json,os
from playwright.sync_api import sync_playwright
ROOT=os.path.join(os.path.dirname(__file__),'..','..');OUT=os.environ.get('OUT','/tmp')
srv=subprocess.Popen(['python3','-m','http.server','18765'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
D={"version":9,"names":{"p1":"Paul","p2":"Lucie"},"ratio":50,"births":{"p1":"1994-05-02","p2":"1996-01-20"},
 "accounts":[{"id":"acc-joint","label":"Compte joint","owner":"joint"}],"fixed":[],"incomes":[],"misc":[],"months":[],"goals":[],"transfer":{"amount":0},
 "insurances":[{"id":"h1","type":"habitation","label":"Habitation appartement","insurer":"Assureur Exemple","premium":18,"premiumFreq":"mois","franchise":"Franchise générale : 150 €","guarantees":"Incendie, dégât des eaux, vol, responsabilité civile, bris de glace","end":"2027-03-01"},
   {"id":"s1","type":"sante","label":"Mutuelle","insurer":"Mutuelle Exemple","premium":95,"premiumFreq":"mois","guarantees":"Hospitalisation, optique, dentaire"}],
 "placements":[{"id":"av1","type":"av","name":"Assurance vie","owner":"p1","capital":12000,"invested":11000,"monthly":100,"rateMode":"manual","rate":3},
   {"id":"pea1","type":"pea","name":"PEA","owner":"p2","capital":6000,"invested":5500,"monthly":50,"rateMode":"manual","rate":5}],
 "valuations":[{"id":"v1","pid":"av1","date":"2026-09-30","value":12000},{"id":"v2","pid":"pea1","date":"2026-09-30","value":6000}]}
AX="axe.run(document,{runOnly:['wcag2a','wcag2aa']}).then(r=>r.violations.map(v=>v.id+':'+v.nodes.length))"
errs=[]
try:
 with sync_playwright() as p:
  b=p.chromium.launch()
  c=b.new_context(viewport={'width':390,'height':844},locale='fr-FR',timezone_id='Europe/Paris')
  c.add_init_script(f"if(!sessionStorage.s){{localStorage.setItem('budget-couple-data',{json.dumps(json.dumps(D))});localStorage.setItem('budget-couple-me','p1');sessionStorage.s=1}}")
  pg=c.new_page();pg.clock.install(time='2026-10-14T10:00:00+02:00');pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:m.type=='error' and errs.append(m.text))
  pg.goto('http://localhost:18765/');pg.wait_for_function('RATES!==null&&MARKET!==null');pg.wait_for_timeout(500);pg.add_script_tag(path='/tmp/axe.min.js')
  d=pg.evaluate('D');assert d['version']==12 and d['placements'][0]['contract'] is None and d['insurances'][0]['profile']=='locataire' and d['insurances'][1]['persons']==1;print('MIGRATION v9→v10 OK')
  # Assurances
  pg.evaluate("go('assurances')");pg.wait_for_timeout(900)
  assert pg.locator('.item .qbadge').count()==2;pg.screenshot(path=f'{OUT}/v9-assurances-liste.png')
  pg.click('[data-edit-ins="h1"]');pg.wait_for_selector('#insQ .qcard')
  t=pg.inner_text('#insQ');assert '/100' in t and 'Indicatif, pas un conseil' in t and 'non trouvées' in t and 'Sources' in t,t
  s0=pg.evaluate("+document.querySelector('#insQ .qhead b').textContent.split('/')[0]")
  pg.fill('#fIns [name=premium]','30');pg.wait_for_timeout(100)
  s1=pg.evaluate("+document.querySelector('#insQ .qhead b').textContent.split('/')[0]");assert s1<s0,(s0,s1);pg.fill('#fIns [name=premium]','18,00')
  pg.select_option('#fIns [name=profile]','proprietaire');pg.wait_for_timeout(100);assert 'Propriétaire' in pg.inner_text('#insQ') or 'propriétaire' in pg.inner_text('#insQ').lower()
  pg.select_option('#fIns [name=profile]','locataire')
  v=pg.evaluate(AX);print('AXE assurance',v);assert not v
  pg.locator('#insQ').scroll_into_view_if_needed();pg.wait_for_timeout(300);pg.screenshot(path=f'{OUT}/v9-assurance-qualite.png')
  pg.click('#fIns button.btn:not([type])');pg.wait_for_timeout(300);assert pg.evaluate("D.insurances.find(i=>i.id==='h1').profile")=='locataire'
  pg.click('[data-edit-ins="s1"]');pg.wait_for_selector('#insQ .qcard');pg.fill('#fIns [name=persons]','2');pg.wait_for_timeout(100)
  t=pg.inner_text('#insQ');assert 'par personne' in t and '30-39' in t or 'ans' in t,t
  pg.click('#fIns button.btn:not([type])');pg.wait_for_timeout(300);assert pg.evaluate("D.insurances.find(i=>i.id==='s1').persons")==2
  # Assurance vie : préremplissage contrat connu
  pg.evaluate("placSheet('av1')");pg.wait_for_selector('#fContract')
  assert 'Renseignez les frais' in pg.inner_text('#sheet')
  pg.select_option('#ctKnown','predissime-9-s2');assert pg.input_value('#fContract [name=entryFee]')!=''
  pg.click('#fContract button');pg.wait_for_selector('#sheet .qcard')
  c1=pg.evaluate("D.placements.find(p=>p.id==='av1').contract");assert c1['known']=='predissime-9-s2' and c1['entryFee']>0,c1
  t=pg.inner_text('#sheet');assert 'coût estimé des frais sur 10 ans' in t.lower() and 'contrats en ligne' in t and 'Indicatif, pas un conseil' in t and '14 octobre 2026' in t,t
  assert 'recommand' not in t.replace('Aucun produit n’est recommandé','').lower()
  v=pg.evaluate(AX);print('AXE contrat AV',v);assert not v
  pg.locator('#fContract').scroll_into_view_if_needed();pg.wait_for_timeout(300);pg.screenshot(path=f'{OUT}/v9-av-contrat.png')
  pg.locator('#sheet .qcard').last.scroll_into_view_if_needed();pg.wait_for_timeout(300);pg.screenshot(path=f'{OUT}/v9-av-frais-10-ans.png')
  # modif manuelle : les frais d'entrée à 0 améliorent la note
  g0=pg.evaluate("ctQ(D.placements.find(p=>p.id==='av1')).score");pg.fill('#fContract [name=entryFee]','0');pg.click('#fContract button');pg.wait_for_timeout(200)
  assert pg.evaluate("ctQ(D.placements.find(p=>p.id==='av1')).score")>g0
  # PEA
  pg.evaluate("placSheet('pea1')");pg.wait_for_selector('#fContract');pg.select_option('#ctKnown','pea-bnp');pg.click('#fContract button');pg.wait_for_selector('#sheet .qcard')
  t=pg.inner_text('#sheet');assert 'courtage' in t.lower() and 'droits de garde' in t.lower(),t;v=pg.evaluate(AX);print('AXE PEA',v);assert not v
  pg.locator('#sheet .qcard').first.scroll_into_view_if_needed();pg.wait_for_timeout(300);pg.screenshot(path=f'{OUT}/v9-pea-qualite.png')
  pg.evaluate("closeSheet();go('placements')");pg.wait_for_timeout(900);assert pg.locator('.item .qbadge').count()>=2;pg.screenshot(path=f'{OUT}/v9-placements-badges.png')
  # largeurs
  for w in (320,768):
    pg.set_viewport_size({'width':w,'height':800});pg.evaluate("placSheet('av1')");pg.wait_for_timeout(300)
    assert pg.evaluate("document.documentElement.scrollWidth<=innerWidth+1"),w
  # survit au rechargement
  pg.reload();pg.wait_for_function('MARKET!==null');assert pg.evaluate("D.placements.find(p=>p.id==='pea1').contract.known")=='pea-bnp'
  b.close()
 assert not errs,errs;print('TEST QUALITÉ OK')
finally:srv.kill()
