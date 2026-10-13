import subprocess,time,json
from playwright.sync_api import sync_playwright
srv=subprocess.Popen(['python3','-m','http.server','8765'],cwd=__import__('os').path.join(__import__('os').path.dirname(__file__),'..','..'),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
errs=[]
V4={"version":4,"placements":[{"id":"old","name":"Ancien placement (exemple)","owner":"common","capital":1000,"monthly":50,"rate":2,"u":5,"c":0}],"updated":5}
with sync_playwright() as p:
  b=p.chromium.launch();c=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True,locale='fr-FR')
  c.add_init_script(f"if(!sessionStorage.s){{localStorage.setItem('budget-couple-data',{json.dumps(json.dumps(V4))});localStorage.setItem('budget-couple-me','p1');sessionStorage.s=1}}")
  pg=c.new_page();pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:m.type=='error' and errs.append(m.text));pg.on('dialog',lambda d:d.accept())
  pg.goto('http://localhost:8765/');pg.wait_for_function('RATES!==null')
  d=pg.evaluate('D');assert d['version']==5 and d['placements'][0]['type']=='autre' and d['placements'][0]['rateMode']=='manual' and d['positions']==[];print('MIGRATION v4→v5 OK')
  pg.click('[data-tab=placements]');pg.wait_for_timeout(300)
  def new(type_,name,bank,cap,mon,extra=None):
    pg.click('#addPlac');pg.wait_for_timeout(250);pg.select_option('#ptype',type_);pg.wait_for_timeout(150)
    pg.fill('#fPlac [name=name]',name);pg.fill('#fPlac [name=bank]',bank)
    if cap is not None and pg.locator('#fPlac [name=capital]').count():pg.fill('#fPlac [name=capital]',cap)
    pg.fill('#fPlac [name=monthly]',mon)
    if extra:extra()
    pg.click('#fPlac .btn:not(.danger)');pg.wait_for_timeout(300)
  new('livretA','Livret A Emilien (exemple)','Banque Exemple','5000','100')
  pid=pg.evaluate("D.placements.find(p=>p.type==='livretA').id")
  assert pg.evaluate(f"rateInfo(D.placements.find(p=>p.id==='{pid}')).rate")==1.7;print('LIVRET A auto 1,7 %')
  new('lep','LEP Julie (exemple)','Banque en ligne Exemple','3000','50');assert pg.evaluate("rateInfo(D.placements.find(p=>p.type==='lep')).rate")==2.5
  def pel():pg.fill('#pelDate','2024-05-10');pg.dispatch_event('#pelDate','change');assert pg.input_value('#pelRate') in ('2,25','2.25')
  new('pel','PEL (exemple)','Banque Exemple','8000','45',pel);r=pg.evaluate("D.placements.find(p=>p.type==='pel')");assert r['rate']==2.25 and r['openDate']=='2024-05-10';print('PEL figé 2,25 %')
  # le PEL ne bouge pas même si les taux changent
  pg.evaluate("RATES.pel.byOpening.unshift({from:'2024-01-01',rate:9});render()");assert pg.evaluate("rateInfo(D.placements.find(p=>p.type==='pel')).rate")==2.25;pg.evaluate("RATES.pel.byOpening.shift()")
  def lj():assert pg.input_value('#fPlac [name=rate]') in ('1,7','1.7');pg.fill('#fPlac [name=rate]','1,2')
  new('livretJeune','Livret Jeune (exemple)','Banque Exemple','500','0',lj);assert 'minimum' in pg.evaluate("rateInfo(D.placements.find(p=>p.type==='livretJeune')).warn");print('LIVRET JEUNE plancher OK')
  # bascule manuelle Livret A
  pg.click(f'[data-edit-plac="{pid}"]');pg.wait_for_timeout(250);pg.check('#manualRate',force=True);pg.fill('#fPlac [name=rate]','3');pg.click('#fPlac .btn:not(.danger)');pg.wait_for_timeout(250)
  assert pg.evaluate(f"rateInfo(D.placements.find(p=>p.id==='{pid}')).rate")==3
  pg.click(f'[data-edit-plac="{pid}"]');pg.wait_for_timeout(250);pg.uncheck('#manualRate',force=True);pg.click('#fPlac .btn:not(.danger)');pg.wait_for_timeout(250)
  assert pg.evaluate(f"rateInfo(D.placements.find(p=>p.id==='{pid}')).rate")==1.7;print('BASCULE manuel/auto OK')
  # assurance vie + lignes
  new('av','Assurance vie (exemple)','Assureur Exemple',None,'0');pg.wait_for_timeout(300)
  assert pg.is_visible('[data-add-pos]')
  pg.click('[data-add-pos]');pg.wait_for_timeout(250);pg.select_option('#pkind','euro');pg.wait_for_timeout(150)
  pg.fill('#fPos [name=name]','Fonds euros (exemple)');pg.fill('#fPos [name=invested]','10000');pg.fill('#fPos [name=value]','10450');pg.fill('#fPos [name=rate]','2,5');pg.fill('#fPos [name=monthly]','100');pg.click('#fPos .btn:not(.danger):not(.ghost)');pg.wait_for_timeout(300)
  pg.click('[data-add-pos]');pg.wait_for_timeout(250)
  pg.fill('#fPos [name=name]','ETF Monde (exemple)');pg.fill('#isinIn','IE00B4L5Y984');assert 'invalide' in pg.inner_text('#isinMsg')
  pg.click('#fPos .btn:not(.danger):not(.ghost)');pg.wait_for_timeout(200);assert pg.evaluate("D.positions.length")==1;print('ISIN invalide refusé')
  pg.fill('#isinIn','IE00B4L5Y983');assert 'valide' in pg.inner_text('#isinMsg')
  pg.fill('#fPos [name=qty]','40');pg.fill('#fPos [name=pru]','80');pg.fill('#fPos [name=price]','95,5');pg.fill('#fPos [name=rate]','6');pg.fill('#fPos [name=monthly]','150')
  pg.screenshot(path='/tmp/v3-12-ligne-isin.png');pg.click('#fPos .btn:not(.danger):not(.ghost)');pg.wait_for_timeout(300)
  pg.click('[data-add-pos]');pg.wait_for_timeout(250);pg.select_option('#pkind','action');pg.fill('#fPos [name=name]','Action (exemple)');pg.fill('#isinIn','FR0000120271');pg.fill('#fPos [name=qty]','10');pg.fill('#fPos [name=pru]','60');pg.fill('#fPos [name=price]','55');pg.fill('#fPos [name=rate]','4');pg.click('#fPos .btn:not(.danger):not(.ghost)');pg.wait_for_timeout(400)
  av=pg.evaluate("(()=>{const p=D.placements.find(p=>p.type==='av');return{v:placValue(p),n:posOf(p.id).length}})()");assert av['n']==3 and abs(av['v']-(10450+40*95.5+550))<.01,av;print('ENVELOPPE',av)
  pg.screenshot(path='/tmp/v3-11-enveloppe.png');pg.keyboard.press('Escape');pg.wait_for_timeout(300)
  # projection : comparaison avec un calcul indépendant
  proj=pg.evaluate("project(streams())[48].total")
  def fv(c,m,r):
    v=c
    for _ in range(48):v=v*(1+r/100/12)+m
    return v
  exp=fv(1000,50,2)+fv(5000,100,1.7)+fv(3000,50,2.5)+fv(8000,45,2.25)+fv(500,0,1.2)+fv(10450,100,2.5)+fv(3820,150,6)+fv(550,0,4)
  assert abs(proj-exp)<0.01,(proj,exp);print('PROJECTION 4 ans',round(proj,2))
  # filtre banque
  pg.check('[name=bankF][value="Banque Exemple"]',force=True);pg.wait_for_timeout(300);assert pg.locator('[data-edit-plac]').count()==3;pg.check('[name=bankF][value=""]',force=True);print('FILTRE BANQUE OK')
  # suppression en cascade
  pg.wait_for_timeout(1200);pg.screenshot(path='/tmp/v3-10-placements.png')
  pg.evaluate("document.querySelector('.group').scrollIntoView()");pg.wait_for_timeout(300);pg.screenshot(path='/tmp/v3-10b-placements-banques.png')
  pg.evaluate("window.scrollTo(0,document.body.scrollHeight)");pg.wait_for_timeout(300);pg.screenshot(path='/tmp/v3-10c-taux-officiels.png')
  avid=pg.evaluate("D.placements.find(p=>p.type==='av').id");pg.evaluate(f"del('placements','{avid}')");assert pg.evaluate("D.positions.length")==0;print('CASCADE OK')
  pg.add_script_tag(url='https://cdn.jsdelivr.net/npm/axe-core@4/axe.min.js');print('AXE',pg.evaluate("axe.run(document,{runOnly:['wcag2a','wcag2aa']}).then(r=>r.violations.map(v=>v.id+':'+v.nodes.length))"))
  b.close()
srv.terminate();print('ERREURS:',errs)
