"""Check-up global : tous les onglets et feuilles, données vides / anciennes / volumineuses, 320-768 px, console JS, axe.
Réseau externe bloqué (aucun appel Supabase réel possible)."""
import subprocess,time,json,os,random
from playwright.sync_api import sync_playwright
ROOT=os.path.join(os.path.dirname(__file__),'..','..');OUT=os.environ.get('OUT','/tmp')
srv=subprocess.Popen(['python3','-m','http.server','18766'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
random.seed(7)
def big():
  cats=['courses','loisirs','transport','sante','autre']
  return {"version":11,"names":{"p1":"Paul","p2":"Lucie"},"ratio":55,"births":{"p1":"1990-01-01","p2":"1992-02-02"},
   "accounts":[{"id":"a1","label":"Joint","owner":"joint"},{"id":"a2","label":"Paul","owner":"p1"}],
   "fixed":[{"id":f"f{i}","label":f"Charge fictive {i} avec un libellé assez long pour tester le retour à la ligne","amount":10+i,"day":1+i%28,"split":50,"category":"autre","paidBy":"joint","account":"a1"} for i in range(40)],
   "incomes":[{"id":"i1","person":"p1","type":"salaire","amount":2500,"recurring":True},{"id":"i2","person":"p2","type":"salaire","amount":2300,"recurring":True}],
   "misc":[{"id":f"m{i}","date":f"2026-{1+i%10:02d}-{1+i%27:02d}","label":f"Dépense {i}","amount":round(random.uniform(1,200),2),"category":cats[i%5],"paidBy":random.choice(['p1','p2','joint']),"for":"common"} for i in range(600)],
   "goals":[{"id":f"g{i}","name":f"Objectif {i}","owner":['common','p1','p2'][i%3],"target":1000+i*100,"saved":i*10,"date":f"20{27+i%3}-0{1+i%9}","split":[None,{"mode":"pct","p1":70},{"mode":"amount","p1":500+i*50,"p2":500+i*50}][i%3] if i%3==0 or True else None} for i in range(30)],
   "months":[{"id":f"mo{i}","month":f"{2022+i//12}-{1+i%12:02d}","a":300+i,"b":250+i} for i in range(57)],
   "placements":[{"id":f"p{i}","type":['livretA','ldds','av','pea','cto','per','pel'][i%7],"name":f"Placement {i}","owner":['common','p1','p2'][i%3],"capital":1000*i,"monthly":50,"rateMode":"manual","rate":2,"openDate":"2020-01-01","invested":900*i} for i in range(21)],
   "valuations":[{"id":f"v{i}","pid":f"p{2+7*(i%3)}","date":f"20{24+i//120}-{1+i%12:02d}-15","value":1000+i} for i in range(300)],
   "insurances":[{"id":f"in{i}","type":['habitation','auto','sante','prevoyance','trottinette','moto'][i%6],"label":f"Assurance {i}","premium":20+i,"premiumFreq":"mois","guarantees":"Responsabilité civile"} for i in range(12)],
   "transfer":{"amount":0}}
def fixgoals(d):
  for g in d['goals']:
    if g['owner']!='common':g['split']=None
    elif g['split'] and g['split']['mode']=='amount':g['split']={'mode':'amount','p1':g['target']/2,'p2':g['target']/2}
  return d
OLD={"fixed":[{"id":"x","label":"Loyer","amount":800,"day":5,"payer":"joint"}],"misc":[{"id":"y","date":"2026-09-02","label":"Courses","amount":40,"payer":"p1"}],"goals":[{"id":"g","name":"Vacances","target":2000,"saved":100}],"months":[{"id":"m","month":"2026-08","a":100,"b":50}],"placements":[{"id":"p","type":"av","capital":1000}],"positions":[{"id":"z","pid":"p","qty":2,"price":50,"cost":90}]}
def geant():
  d=fixgoals(big());L='Libellé particulièrement long pour vérifier le retour à la ligne sans chevauchement ni troncature'
  d['names']={'p1':'Emilien-Alexandre','p2':'Julie-Margaux'}
  for k in ('fixed','misc','goals','placements','insurances'):
    for x in d[k][:8]:
      if 'label' in x:x['label']=L
      if 'name' in x:x['name']=L
      for a in ('amount','target','capital','premium','invested'):
        if a in x:x[a]=1234567.89
  for g in d['goals']:
    if g.get('split') and g['split']['mode']=='amount':g['split']={'mode':'amount','p1':g['target']/2,'p2':g['target']/2}
  d['misc']=d['misc'][:150]
  for x in d['misc'][:10]:x['date']='2026-10-0'+str(1+x['amount']%9 if False else 3)
  d['debts']=[{'id':f'd{i}','from':'p1' if i%2 else 'p2','to':'p2' if i%2 else 'p1','amount':1234567.89,'label':L,'date':'2026-10-10','repaid':None} for i in range(4)]
  d['months'].append({'id':'mx','month':'2026-10','a':1234567.89,'b':1234567.89});d['version']=12
  return d
SETS={'vide':None,'v1':OLD,'gros':fixgoals(big()),'geant':geant()}
OVL='''(()=>{const out=[],R=e=>e.getBoundingClientRect(),vis=e=>{const r=R(e);return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'};
 const scope=document.querySelector('#sheet.open')||document.querySelector('#view');
 scope.querySelectorAll('*').forEach(e=>{if(!vis(e)||!e.childElementCount&&!e.textContent.trim())return;const cs=getComputedStyle(e);
   if((cs.textOverflow==='ellipsis'||(cs.overflow.includes('hidden')&&[...e.querySelectorAll('*')].some(c=>vis(c)&&R(c).right>R(e).right+2)))&&e.scrollWidth>e.clientWidth+2&&e.textContent.trim()&&!e.matches('.bar,.bar *,.split,.split *,svg,svg *,input,select,textarea'))out.push('tronqué: '+e.tagName+'.'+e.className+' «'+e.textContent.trim().slice(0,30)+'»');
   const r=R(e);if(r.right>innerWidth+1&&!e.closest('.hscroll,.chips,.tabs,nav,.chart-scroll,.ichart-scroll'))out.push('déborde: '+e.tagName+'.'+e.className);});
 scope.querySelectorAll('.item,.row-b,.hero-grid,.f2,.f3,.gp,.contrib').forEach(p=>{const k=[...p.children].filter(vis);for(let i=0;i<k.length;i++)for(let j=i+1;j<k.length;j++){const a=R(k[i]),b=R(k[j]);
   const ox=Math.min(a.right,b.right)-Math.max(a.left,b.left),oy=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);if(ox>2&&oy>2)out.push('chevauchement: '+p.className+' › '+k[i].tagName+'.'+k[i].className+' / '+k[j].tagName+'.'+k[j].className)}});
 return [...new Set(out)].slice(0,6)})()'''
AX="axe.run(document,{runOnly:['wcag2a','wcag2aa']}).then(r=>r.violations.map(v=>v.id+':'+v.nodes.length))"
found=[]
try:
 with sync_playwright() as p:
  b=p.chromium.launch()
  for name,data in SETS.items():
   for w in ((320,390,430,768) if name=='geant' else (320,390,768)):
    print('…',name,w,flush=True)
    c=b.new_context(viewport={'width':w,'height':800},locale='fr-FR',timezone_id='Europe/Paris')
    def blk(r):
      u=r.request.url
      if u.startswith('http://localhost:18766'):return r.continue_()
      if 'supabase' in u:found.append('RÉSEAU '+u)
      r.abort()
    c.route('**/*',blk)
    if not data:c.add_init_script("sessionStorage.setItem('budget-couple-more','1')");c.add_init_script("if(!sessionStorage.s){localStorage.setItem('budget-couple-me','p1');sessionStorage.s=1}")
    if data:c.add_init_script("sessionStorage.setItem('budget-couple-more','1')");c.add_init_script(f"if(!sessionStorage.s){{localStorage.setItem('budget-couple-data',{json.dumps(json.dumps(data))});localStorage.setItem('budget-couple-me','p1');sessionStorage.s=1}}")
    pg=c.new_page();pg.clock.install(time='2026-10-14T10:00:00+02:00');errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:m.type=='error' and 'ERR_FAILED' not in m.text and errs.append(m.text))
    t0=time.time();pg.goto('http://localhost:18766/');pg.wait_for_timeout(700);pg.add_script_tag(path='/tmp/axe.min.js')
    if name=='v1':d=pg.evaluate('D');assert d['version']==14 and d['goals'][0]['split'] is None and d['goals'][0]['target']==2000 and d['misc'][0]['amount']==40,d
    tabs=pg.evaluate("TABS.map(t=>t[0]).concat(['reglages','assurances','bilans','activite'].filter(x=>typeof views==='undefined'||views[x]))")
    for t in tabs:
      t1=time.time();pg.evaluate(f"go('{t}')");pg.wait_for_timeout(250);dt=time.time()-t1
      if dt>2:found.append(f'{name} {w} {t}: rendu lent {dt:.1f}s')
      if not pg.evaluate("document.documentElement.scrollWidth<=innerWidth+1"):
        wide=pg.evaluate("[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&!e.closest('[hidden],.chart-scroll,.ichart-scroll,.hscroll')).slice(0,3).map(e=>e.tagName+'.'+e.className)")
        found.append(f'{name} {w} {t}: débordement horizontal {wide}')
      if w==390:
        v=pg.evaluate(AX)
        if v:found.append(f'{name} {t}: axe {v}')
      if name=='geant' and w<=430:
        o=pg.evaluate(OVL)
        if o:found.append(f'{name} {w} {t}: {o}')
      # ouvre chaque type de feuille
      sel=pg.evaluate("[...new Set([...document.querySelectorAll('#view [data-edit-goal],#view [data-edit-plac],#view [data-edit-ins],#view [data-edit-fixed],#view [data-edit-income],#view [data-edit-month],#view [data-edit-misc],#view [data-debt-edit],#view [data-edit-ins],#view [id^=add],#view [data-scroll]')].map(e=>{const a=[...e.attributes].find(a=>a.name.startsWith('data-edit')||a.name==='id');return a?`[${a.name}=\"${a.value}\"]`:null}).filter(Boolean))].slice(0,12)")
      for s in sel:
        try:
          pg.evaluate("go(arguments[0])" if False else f"go('{t}')");pg.wait_for_timeout(120)
          el=pg.locator('#view '+s).first
          if not el.count():continue
          el.click(timeout=2000);pg.wait_for_timeout(200)
          if pg.evaluate("!!document.querySelector('#sheet.open')"):
            if not pg.evaluate("document.querySelector('#sheet').scrollWidth<=document.querySelector('#sheet').clientWidth+1"):found.append(f'{name} {w} {t} {s}: feuille déborde')
            if name=='geant' and w<=430:
              o=pg.evaluate(OVL)
              if o:found.append(f'{name} {w} {t} {s}: {o}')
            if w==390:
              v=pg.evaluate(AX)
              if v:found.append(f'{name} {t} {s}: axe feuille {v}')
            pg.evaluate("closeSheet()");pg.wait_for_timeout(150)
        except Exception as e:found.append(f'{name} {w} {t} {s}: {str(e)[:120]}')
    if errs:found.append(f'{name} {w}: console {errs[:4]}')
    if w==390:pg.evaluate("go('accueil')");pg.wait_for_timeout(900);pg.screenshot(path=f'{OUT}/checkup-{name}.png')
    c.close()
  b.close()
finally:srv.kill()
print('\n'.join(found) or 'AUCUN PROBLÈME');print('CHECKUP',len(found));assert not found
