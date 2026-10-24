"""Assurances : extraction locale (pdf.js / OCR), Storage privé simulé, repli local, 2 appareils, a11y. Données 100 % fictives."""
import subprocess,time,json,sys,os
sys.path.insert(0,os.path.dirname(__file__));from fake_supabase import Fake
from playwright.sync_api import sync_playwright
ROOT=os.path.join(os.path.dirname(__file__),'..','..');FX=os.path.join(ROOT,'tests','fixtures');OUT=os.environ.get('OUT','/tmp')
srv=subprocess.Popen(['python3','-m','http.server','18766'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
errs=[];F=Fake();F.bucket=False
CFG={"url":"https://exemple-fictif.supabase.co","key":"sb_publishable_FICTIF","space":"Exemple-espace-0000"}
F.row={'data':{"version":8,"names":{"p1":"Paul","p2":"Lucie"},"fixed":[{"id":"f1","label":"Assurance habitation","amount":17.9,"day":10,"split":50,"category":"assurance","paidBy":"joint"}]},'updated_at':F.ts()}
AX="axe.run(document,{runOnly:['wcag2a','wcag2aa']}).then(r=>r.violations.map(v=>v.id+':'+v.nodes.length))"
try:
 with sync_playwright() as p:
  b=p.chromium.launch()
  def dev(name,who,w=390):
    c=b.new_context(viewport={'width':w,'height':844},locale='fr-FR')
    c.add_init_script(f"if(!sessionStorage.s){{localStorage.setItem('budget-couple-cfg',{json.dumps(json.dumps(CFG))});localStorage.setItem('budget-couple-me','{who}');sessionStorage.s=1}}")
    c.route('**/*supabase.co/**',lambda r:F.handle(r,name));pg=c.new_page();pg.on('pageerror',lambda e:errs.append(name+': '+str(e)))
    pg.on('console',lambda m:m.type=='error' and 'status of 400' not in m.text and 'status of 404' not in m.text and errs.append(name+' console: '+m.text[:200]));pg.on('response',lambda r:r.status==404 and '/rest/v1/rpc/' not in r.url and errs.append(name+' 404 inattendu: '+r.url))  # 404 attendu : sonde RPC (secure.sql absent)  # 400 attendu : bucket absent;pg.on('dialog',lambda d:d.accept())
    pg.goto('http://localhost:18766/');pg.wait_for_function("document.querySelector('#syncState').textContent.includes('✓')");return pg
  A=dev('A','p1')
  A.evaluate("go('assurances')");A.click('#addIns');A.set_input_files('#insFile',os.path.join(FX,'habitation-fictive.pdf'))
  A.wait_for_function("/information/.test(document.querySelector('#insStatus').textContent)",timeout=20000)
  g=lambda pg,n:pg.eval_on_selector(f'#fIns [name={n}]','e=>e.value')
  got={k:g(A,k) for k in ['insurer','contract','premium','premiumFreq','end','phone','franchise']};print('extraction PDF',got)
  assert got['insurer']=='MACIF' and got['contract']=='HAB-2024-778812' and got['premium']=='214,80' and got['premiumFreq']=='an' and got['end']=='01/03' and '05 49' in got['phone'],got
  A.select_option('#fIns [name=fixedId]','f1');A.screenshot(path=f'{OUT}/v7-3-assurance-extraction.png')
  A.click('#fIns button:not([type])');A.wait_for_timeout(600)
  d=A.evaluate("D.insurances[0].doc");print('doc sans bucket',d);assert d['storage']=='local' and d['why']=='missing'
  # bucket créé par storage.sql → envoi vers Supabase
  F.bucket=True;A.click('[data-edit-ins]');A.click('#insPush');A.wait_for_timeout(800)
  d=A.evaluate("D.insurances[0].doc");print('doc après SQL',d['storage'],list(F.objects));assert d['storage']=='supabase' and len(F.objects)==1
  k=list(F.objects)[0];assert k.split('/')[0]!=CFG['space'] and len(k.split('/')[0])==32
  # second appareil : ouvre le document depuis Storage
  B=dev('B','p2',360);B.evaluate("go('assurances')");B.wait_for_selector('[data-edit-ins]');B.click('[data-edit-ins]');B.click('#insOpen');B.wait_for_selector('#insPreview canvas,#insPreview a',timeout=15000)
  print('B ouvre le doc OK');B.screenshot(path=f'{OUT}/v7-4-assurance-fiche-360.png')
  B.add_script_tag(path='/tmp/axe.min.js');v=B.evaluate(AX);print('AXE fiche',v);assert not v
  B.evaluate("closeSheet()");B.wait_for_timeout(400);v=B.evaluate(AX);print('AXE assurances',v);assert not v
  # PDF scanné sans OCR → message ; puis OCR sur photo
  A.evaluate("closeSheet()");A.wait_for_timeout(300);A.click('#addIns');A.set_input_files('#insFile',os.path.join(FX,'auto-scan.pdf'))
  A.wait_for_function("/OCR/.test(document.querySelector('#insStatus').textContent)",timeout=20000);print('scan sans OCR :',A.inner_text('#insStatus'))
  A.set_input_files('#insFile',os.path.join(FX,'auto-fictive.jpg'));A.wait_for_timeout(300);A.check('#insOcr')  # cocher relance la lecture
  A.wait_for_function("/trouvée|aucune information/.test(document.querySelector('#insStatus').textContent)",timeout=180000)
  got={k:g(A,k) for k in ['insurer','contract','premium','premiumFreq','object','type']};print('OCR photo',A.inner_text('#insStatus'),got)
  # le logo « AXA » en très gros caractères n'est pas toujours reconnu par l'OCR : champ laissé vide à compléter
  assert '0098765432' in got['contract'] and got['premiumFreq']=='mois' and got['premium']=='42,50' and got['type']=='auto',got
  A.select_option('#fIns [name=fixedId]','__new');A.click('#fIns button:not([type])');A.wait_for_timeout(800)
  print('charge créée',A.evaluate("D.fixed.map(f=>f.label+':'+f.amount)"))
  # suppression : le fichier Storage est supprimé aussi
  n0=len(F.objects);ids=A.evaluate("D.insurances.map(i=>i.id)");A.click('[data-edit-ins]');A.wait_for_selector('#sheet [data-del^="insurances|"]')
  A.evaluate("()=>{window.confirm=()=>true;document.querySelector('#sheet [data-del^=\"insurances|\"]').click()}");A.wait_for_timeout(1000)
  left=A.evaluate("D.insurances.map(i=>i.id)");gone=[i for i in ids if i not in left];print('supprimée',gone,'objets',n0,'→',len(F.objects))
  assert len(gone)==1 and not any(k.split('/')[1]==gone[0] for k in F.objects) and len(F.objects)==n0-1
  b.close()
finally:srv.terminate()
print('ERREURS',errs);assert not errs
print('ASSURANCES OK')
