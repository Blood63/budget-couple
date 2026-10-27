"""v14 : effort mensuel par personne pour les objectifs. Données 100 % fictives, aucun Supabase."""
import subprocess,time,json,os,sys
from playwright.sync_api import sync_playwright
ROOT=os.path.join(os.path.dirname(__file__),'..','..');OUT=os.environ.get('OUT','/tmp/v14');os.makedirs(OUT,exist_ok=True)
PORT=18771;srv=subprocess.Popen(['python3','-m','http.server',str(PORT)],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
URL=f'http://localhost:{PORT}/'
AX="axe.run(document,{runOnly:['wcag2a','wcag2aa']}).then(r=>r.violations.map(v=>v.id+':'+v.nodes.length+' '+v.nodes[0].target.join(' ')))"
SEED={"version":13,"names":{"p1":"Alice","p2":"Bruno"},"births":{"p1":"","p2":""},"ratio":50,
 "months":[{"id":"s1","month":"2026-08","a":100,"b":50},{"id":"s2","month":"2026-09","a":100,"b":50},{"id":"s3","month":"2026-10","a":100,"b":50}],
 "goals":[{"id":"g1","name":"Voyage fictif","owner":"common","target":2000,"saved":200,"date":"2027-04","split":{"mode":"pct","p1":60}},
          {"id":"g2","name":"Vélo fictif","owner":"p1","target":600,"date":"2027-01"},
          {"id":"g3","name":"Projet sans date","owner":"p2","target":300},
          {"id":"g4","name":"Ancien projet","owner":"common","target":400,"date":"2026-06"},
          {"id":"g5","name":"Déjà atteint","owner":"p2","target":50,"saved":80,"date":"2027-02"}],"updated":1000}
errs=[]
norm=lambda s:s.replace('\u202f',' ').replace('\xa0',' ')
try:
 with sync_playwright() as p:
  b=p.chromium.launch()
  def dev(scheme='dark',w=390):
    c=b.new_context(viewport={'width':w,'height':900},locale='fr-FR',timezone_id='Europe/Paris',color_scheme=scheme)
    c.add_init_script("if(!sessionStorage.s){localStorage.setItem('budget-couple-data',"+json.dumps(json.dumps(SEED))+");localStorage.setItem('budget-couple-me','p1');sessionStorage.s=1}")
    c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(URL) else r.abort())
    pg=c.new_page();pg.clock.install(time='2026-10-17T13:00:00+02:00');pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.on('console',lambda m:m.type=='error' and errs.append(m.text));pg.on('dialog',lambda d:d.accept())
    pg.goto(URL);pg.wait_for_function('RATES!==null');pg.evaluate("go('objectifs')");pg.wait_for_timeout(300);return pg
  pg=dev()
  R=pg.evaluate("goalNeeds(compute(),curMonth())");print('totaux',R['total'],'retard',R['late'],'sans date',R['nodate'])
  # g1 : part 1200/800, versé initial 200 réparti 60/40 + épargne allouée ; g2 perso 6 → 3 mois ; g4 dépassé ; g3 sans date ; g5 atteint
  per={g['id']:g['per'] for g in R['goals']}
  assert per['g5']['p2']=={'rest':0,'monthly':0,'status':'done'} and per['g3']['p2']['status']=='nodate' and R['late']==['g4'] and R['nodate']==['g3']
  assert per['g2']['p2']['status']=='done' and per['g2']['p1']['status']=='ok'
  for g in R['goals']:
    for k,x in g['per'].items():
      if x['status']=='ok':assert x['monthly']*g['months']+1e-9>=x['rest'] and (x['monthly']-0.01)*g['months']<x['rest']+1e-9 and round(x['monthly'],2)==x['monthly']
  tp1=round(sum(g['per']['p1']['monthly'] for g in R['goals'] if g['per']['p1']['status']=='ok'),2);assert abs(tp1-R['total']['p1'])<1e-9
  t=norm(pg.locator('#goalNeeds').inner_text());print(t.replace('\n',' | '))
  assert 'À mettre de côté chaque mois' in t and 'Épargne actuelle : 100,00 €/mois' in t and 'Épargne actuelle : 50,00 €/mois' in t and 'dépassée' in t and 'sans date' in t
  assert ('Manque' in t) and ('Alice' in t and 'Bruno' in t)
  v=norm(pg.locator('#view').inner_text());assert 'échéance dépassée, reste' in v and '0 € (part atteinte)' in v and 'ajoutez une date' in v and '/mois' in v
  # données intactes (aucun changement de format)
  d=pg.evaluate('JSON.parse(localStorage.getItem("budget-couple-data"))');assert d['goals'][0]['split']=={'mode':'pct','p1':60} and d['version']==13 and len(d['goals'])==5
  pg.locator('#goalNeeds').screenshot(path=OUT+'/v14-objectifs-carte.png')
  pg.set_viewport_size({'width':390,'height':1400});pg.wait_for_timeout(200);pg.screenshot(path=OUT+'/v14-objectifs-mensuel.png',clip={'x':0,'y':0,'width':390,'height':1100})
  pg.context.close()
  for sc in ['light','dark']:
    for w in [320,390,768]:
      pg=dev(sc,w);pg.add_script_tag(path='/tmp/axe.min.js');v=pg.evaluate(AX);assert not v,(sc,w,v)
      ov=pg.evaluate("document.documentElement.scrollWidth-innerWidth");assert ov<=0,(sc,w,ov)
      if w==320:pg.screenshot(path=f'{OUT}/v14-objectifs-320-{sc}.png',full_page=True)
      pg.context.close()
    print('thème',sc,'axe + 320/390/768 OK')
  # sans objectif : pas de carte ; sans épargne saisie : message
  print('ERREURS',errs);assert not errs;print('V14 OK')
finally:srv.terminate()
