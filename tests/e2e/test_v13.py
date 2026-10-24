"""v13 : sécurité Supabase (RPC + repli), changement de code, invitation code seul, appareil vierge, plafonds par catégorie,
accueil allégé, bandeau hors ligne, thème clair/sombre, manifest. Données 100 % fictives, Supabase simulé."""
import subprocess,time,json,os,sys,re
sys.path.insert(0,os.path.dirname(__file__));from fake_supabase import Fake
from playwright.sync_api import sync_playwright
ROOT=os.path.join(os.path.dirname(__file__),'..','..');OUT=os.environ.get('OUT','/tmp/v13');os.makedirs(OUT,exist_ok=True)
PORT=18770;srv=subprocess.Popen(['python3','-m','http.server',str(PORT)],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
URL=f'http://localhost:{PORT}/'
AX="axe.run(document,{runOnly:['wcag2a','wcag2aa']}).then(r=>r.violations.map(v=>v.id+':'+v.nodes.length+' '+v.nodes[0].target.join(' ')))"
CFG={"url":"https://exemple-fictif.supabase.co","key":"sb_publishable_FICTIF","space":"Espace-fictif-Test-2026"}
SEED={"version":12,"names":{"p1":"Alice","p2":"Bruno"},"births":{"p1":"1990-01-02","p2":"1991-03-04"},"ratio":60,"budget":{"2026-10":600},
 "fixed":[{"id":"f1","label":"Loyer fictif","amount":900,"day":5,"split":60,"category":"logement","paidBy":"joint"}],
 "misc":[{"id":"m1","date":"2026-10-03","label":"Resto fictif","amount":95,"category":"resto","paidBy":"p1","for":"common","payer":"common"},
         {"id":"m2","date":"2026-10-08","label":"Courses fictives","amount":120,"category":"courses","paidBy":"joint","for":"common","payer":"common"}],
 "goals":[{"id":"g1","name":"Voyage fictif","owner":"common","target":2000,"saved":200}],
 "insurances":[{"id":"ins1","type":"habitation","label":"Habitation fictive","premium":12,"premiumFreq":"mois"}],"updated":1000}
errs=[];alerts=[]
def norm(s):return s.replace('\u202f',' ').replace('\xa0',' ')
try:
 with sync_playwright() as p:
  b=p.chromium.launch()
  def dev(name,F,who='p1',cfg=CFG,data=None,scheme='dark',w=390,wait=True,hash=''):
    c=b.new_context(viewport={'width':w,'height':844},locale='fr-FR',timezone_id='Europe/Paris',color_scheme=scheme)
    init="if(!sessionStorage.s){"+(f"localStorage.setItem('budget-couple-cfg',{json.dumps(json.dumps(cfg))});" if cfg else '')+(f"localStorage.setItem('budget-couple-data',{json.dumps(json.dumps(data))});" if data else '')+f"localStorage.setItem('budget-couple-me','{who}');sessionStorage.s=1}}"
    c.add_init_script(init)
    c.route('**/*',lambda r:F.handle(r,name) if 'supabase.co' in r.request.url else (r.continue_() if r.request.url.startswith(URL) else r.abort()))
    pg=c.new_page();pg.clock.install(time='2026-10-17T13:00:00+02:00');pg.on('pageerror',lambda e:errs.append(name+': '+str(e)))
    pg.on('console',lambda m:m.type=='error' and 'status of 40' not in m.text and errs.append(name+' console: '+m.text[:200]))
    pg.on('response',lambda r:r.status==404 and '/rest/v1/rpc/' not in r.url and errs.append(name+' 404: '+r.url))
    pg.on('dialog',lambda d:(alerts.append(d.message) if d.type=='alert' else None,d.accept()))
    pg.goto(URL+hash);pg.wait_for_function('RATES!==null')
    if wait and cfg:pg.wait_for_function("document.querySelector('#syncState').textContent.includes('✓')",timeout=8000)
    return pg
  st=lambda pg:pg.evaluate('JSON.parse(localStorage.getItem("budget-couple-data"))')

  # 1) Sécurité renforcée : RPC uniquement, deux appareils, fusion concurrente
  F=Fake(secure=True);F.row={'data':SEED,'updated_at':F.ts()}
  A=dev('A',F,'p1');B=dev('B',F,'p2')
  assert F.table_calls==0 and F.rpc_calls>0,(F.table_calls,F.rpc_calls)
  A.evaluate("D.misc.push({id:'a1',date:'2026-10-10',label:'Ciné A',amount:20,category:'loisirs',paidBy:'p1',for:'common',payer:'common'});save()")
  B.evaluate("D.misc.push({id:'b1',date:'2026-10-11',label:'Livre B',amount:15,category:'loisirs',paidBy:'p2',for:'p2',payer:'p2'});D.ratio=55;save()")
  A.wait_for_timeout(900);A.evaluate("pullRemote()");B.evaluate("pullRemote()");A.wait_for_timeout(900);A.evaluate("pullRemote()");A.wait_for_timeout(500);B.evaluate("pullRemote()");B.wait_for_timeout(600)
  ids=sorted(x['id'] for x in F.row['data']['misc']);assert ids==['a1','b1','m1','m2'] and A.evaluate('canon(D)')==B.evaluate('canon(D)') and F.row['data']['ratio']==55,ids
  assert F.row['data']['names']=={'p1':'Alice','p2':'Bruno'};print('RPC 2 appareils OK, conflits',F.conflicts,'table',F.table_calls)
  A.evaluate("go('reglages')");A.wait_for_timeout(300);sc=norm(A.locator('#securityCard').inner_text());print(sc.replace('\n',' | '))
  assert 'Sécurité renforcée : Oui' in sc and 'Faible' in sc and A.locator('#changeCode').is_enabled()

  # 2) Ancien schéma : repli table, « Non », puis bascule automatique quand secure.sql est installé
  G=Fake(secure=False);G.row={'data':SEED,'updated_at':G.ts()}
  C=dev('C',G,'p1');C.evaluate("go('reglages')");C.wait_for_timeout(300)
  assert 'Sécurité renforcée : Non' in C.locator('#securityCard').inner_text() and C.locator('#changeCode').is_disabled() and G.table_calls>0
  C.evaluate("D.misc.push({id:'c1',date:'2026-10-12',label:'X',amount:3,category:'autre',paidBy:'p1',for:'p1',payer:'p1'});save()");C.wait_for_timeout(800)
  assert any(x['id']=='c1' for x in G.row['data']['misc'])
  G.secure=True;C.evaluate("D.misc.push({id:'c2',date:'2026-10-12',label:'Y',amount:4,category:'autre',paidBy:'p1',for:'p1',payer:'p1'});save()");C.wait_for_timeout(1200)
  assert any(x['id']=='c2' for x in G.row['data']['misc']),'bascule RPC';C.wait_for_timeout(300)
  assert C.evaluate('secureMode')==True and 'Oui' in C.locator('#secState').inner_text();print('repli table + bascule RPC OK')
  C.context.close()

  # 3) Appareil vierge qui rejoint par lien : n'écrase pas prénoms/réglages
  link=A.evaluate('inviteLink()');h=link.split('#',1)[1]
  E=dev('E',F,'p2',cfg=None,wait=False,hash='#'+h);E.wait_for_function("document.querySelector('#syncState').textContent.includes('✓')",timeout=8000)
  d=st(E);assert d['names']=={'p1':'Alice','p2':'Bruno'} and d['births']['p1']=='1990-01-02' and d['ratio']==55,(d['names'],d['ratio'])
  assert F.row['data']['names']=={'p1':'Alice','p2':'Bruno'} and F.row['data']['births']['p2']=='1991-03-04';print('appareil vierge OK');E.context.close()

  # 4) Invitation : lien complet / code seul
  A.evaluate("go('reglages')");A.click('#inviteBtn');A.wait_for_timeout(200);assert 'Lien complet' in A.locator('#invitePanel').inner_text()
  A.click('[data-inv=code]');A.wait_for_timeout(200);t=A.locator('#invitePanel').inner_text();assert 'code d’espace est le vrai secret' in t and A.locator('#inviteLink').input_value()==CFG['space']
  A.add_script_tag(path='/tmp/axe.min.js');v=A.evaluate(AX);print('AXE réglages/invitation',v);assert not v
  A.evaluate("document.querySelector('#tabs').style.display='none'");A.locator('#invitePanel').screenshot(path=f'{OUT}/v13-invitation-code-seul.png')
  A.locator('#securityCard').screenshot(path=f'{OUT}/v13-securite.png');A.evaluate("document.querySelector('#tabs').style.display=''")

  # 5) Changer le code d'espace (document copié, ancien espace marqué, rien d'effacé)
  A.evaluate("(async()=>{const ins=D.insurances[0];ins.doc=await saveDoc(ins,new File(['%PDF-1.4 fictif'],'contrat-fictif.pdf',{type:'application/pdf'}));save()})()");A.wait_for_timeout(1200)
  oldPath=st(A)['insurances'][0]['doc']['path'];assert st(A)['insurances'][0]['doc']['storage']=='supabase' and oldPath in F.objects
  A.evaluate("go('reglages')");A.wait_for_timeout(300);A.click('#changeCode');A.wait_for_function("cfg.space.startsWith('bc-')",timeout=10000);A.wait_for_timeout(1200)
  nw=A.evaluate('cfg.space');assert re.fullmatch(r'bc-([a-z2-9]{5}-){4}[a-z2-9]{6}',nw),nw
  assert nw in F.rows and F.rows['__main__']['data'].get('moved') and len(F.rows['__main__']['data']['misc'])==4,'ancien espace intact + marqué'
  newd=F.rows[nw]['data'];np=newd['insurances'][0]['doc']['path'];assert np!=oldPath and np in F.objects and oldPath in F.objects,'doc copié, ancien conservé'
  fold=A.evaluate(f"spaceFolder({json.dumps(nw)})");assert np.startswith(fold+'/')
  assert sorted(x['id'] for x in newd['misc'])==['a1','b1','m1','m2'] and newd['names']['p1']=='Alice' and 'moved' not in newd
  assert A.evaluate("loadDoc(D.insurances[0]).then(b=>b.size)")>0
  assert 'Fort' in A.locator('#securityCard').inner_text() and A.locator('#clearOld').count()==1;print('changement de code OK',nw[:8]+'…')
  # l'autre appareil : espace déplacé, n'écrit plus ; ses saisies passent dans le nouveau code après « code seul »
  B.evaluate("D.misc.push({id:'b2',date:'2026-10-13',label:'Saisie B après déplacement',amount:9,category:'courses',paidBy:'p2',for:'p2',payer:'p2'});save()");B.wait_for_timeout(900)
  assert B.evaluate('!!spaceMoved') and 'déplacé' in B.locator('#syncState').inner_text() and not any(x['id']=='b2' for x in F.rows['__main__']['data']['misc'])
  B.evaluate("go('accueil')");B.wait_for_timeout(200);assert 'déplacé' in B.locator('#view').inner_text()
  B.goto(URL+'#join='+nw);B.wait_for_function("cfg.space.startsWith('bc-')&&document.querySelector('#syncState').textContent.includes('✓')",timeout=8000)
  assert any(x['id']=='b2' for x in F.rows[nw]['data']['misc']) and B.evaluate('!spaceMoved');print('autre appareil rejoint par code seul OK, aucune perte')
  # vider l'ancien espace (seulement si tout est présent)
  A.evaluate("pullRemote()");A.wait_for_timeout(600);A.evaluate("go('reglages')");A.wait_for_timeout(200);A.click('#clearOld');A.wait_for_timeout(1200)
  od=F.rows['__main__']['data'];assert od.get('emptied') and od.get('moved') and A.locator('#clearOld').count()==0,od
  assert len(F.rows[nw]['data']['misc'])==5;print('ancien espace vidé après vérification OK')

  # 6) Plafonds par catégorie + accueil allégé
  A.evaluate("go('budget')");A.wait_for_timeout(200);A.evaluate("document.querySelector('[data-seg=diverses]')?.click()");A.wait_for_timeout(300)
  A.click('#editCaps');A.fill('#fCaps [name=resto]','100');A.fill('#fCaps [name=courses]','400');A.click('#fCaps .btn');A.wait_for_timeout(400)
  assert st(A)['catBudget']=={'resto':100,'courses':400};caps=norm(A.locator('#capsH').locator('xpath=ancestor::section').inner_text());print(caps.replace('\n',' | '))
  assert 'Restaurants' in caps and 'rythme trop élevé' in caps and 'Courses' in caps and 'reste 271' in caps
  v=A.evaluate(AX);print('AXE plafonds',v);assert not v
  A.evaluate("document.querySelector('#tabs').style.display='none'");A.locator('#capsH').locator('xpath=ancestor::section').screenshot(path=f'{OUT}/v13-plafonds-categorie.png');A.evaluate("document.querySelector('#tabs').style.display=''")
  A.evaluate("go('accueil')");A.wait_for_timeout(400);home=norm(A.locator('#view').inner_text())
  assert 'Plafonds de catégorie' in home and 'Restaurants' in home and A.locator('#homeMore').count()==1 and not A.locator('#homeMore').get_attribute('open') is not None
  top=A.evaluate("[...document.querySelectorAll('#view > .card, #view > section')].length");print('cartes en tête',top)
  acts=A.evaluate("[...document.querySelectorAll('#view > .card:not(.hero):not(.safe-spend), #view > section.card:not(.safe-spend)')].filter(e=>!e.closest('details')).length");assert acts<=3,acts
  A.click('#homeMore summary');A.wait_for_timeout(200);assert A.locator('#homeMore').get_attribute('open') is not None
  A.evaluate("render()");A.wait_for_timeout(200);assert A.locator('#homeMore').get_attribute('open') is not None,'Plus reste ouvert après synchro'
  A.click('#homeMore summary');A.wait_for_timeout(100);v=A.evaluate(AX);print('AXE accueil',v);assert not v
  A.evaluate("document.querySelector('#tabs').style.display='none'");A.screenshot(path=f'{OUT}/v13-accueil-allege.png');A.evaluate("document.querySelector('#tabs').style.display=''")
  # B reçoit les plafonds
  B.evaluate("pullRemote()");B.wait_for_timeout(700);assert st(B)['catBudget']=={'resto':100,'courses':400}

  # 7) Hors ligne : texte honnête
  A.context.set_offline(True);A.evaluate("dispatchEvent(new Event('offline'))");A.wait_for_timeout(200);ob=A.locator('#offline').inner_text()
  assert 'ne peut pas être rouverte' in ob and A.locator('#offline').is_visible();A.locator('#offline').screenshot(path=f'{OUT}/v13-hors-ligne.png')
  A.context.set_offline(False);A.evaluate("dispatchEvent(new Event('online'))");A.wait_for_timeout(500);assert A.locator('#offline').is_hidden()

  # 8) Thème clair/sombre (auto + manuel) et axe sur tous les onglets à 320/390/768
  for scheme in ['light','dark']:
    for w in [320,390,768]:
      T=dev('T',F,'p1',cfg={**CFG,'space':nw},scheme=scheme,w=w);T.add_script_tag(path='/tmp/axe.min.js')
      bg=T.evaluate("getComputedStyle(document.body).backgroundColor");assert ('243, 245, 250' in bg)==(scheme=='light'),bg
      for tab in ['accueil','budget','epargne','objectifs','placements','assurances','bilans','activite','reglages']:
        T.evaluate(f"go('{tab}')");T.wait_for_timeout(250)
        ov=T.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth");assert ov<=1,(scheme,w,tab,ov)
        v=T.evaluate(AX);assert not v,(scheme,w,tab,v)
      if w==390:
        T.evaluate("go('accueil')");T.wait_for_timeout(300);T.evaluate("document.querySelector('#tabs').style.display='none'");T.screenshot(path=f'{OUT}/v13-theme-{"clair" if scheme=="light" else "sombre"}.png');T.evaluate("document.querySelector('#tabs').style.display=''")
      T.context.close()
    print('thème',scheme,'axe + 320/390/768 OK')
  T=dev('T',F,'p1',cfg={**CFG,'space':nw},scheme='dark');T.evaluate("go('reglages')");T.wait_for_timeout(200)
  T.check('input[name=theme][value=light]',force=True);T.wait_for_timeout(100);assert T.evaluate("document.documentElement.dataset.theme")=='light' and T.evaluate("localStorage.getItem('budget-couple-theme')")=='light'
  assert T.evaluate("document.querySelector('meta[name=theme-color]').content")=='#f3f5fa';T.reload();T.wait_for_function('RATES!==null');assert T.evaluate("document.documentElement.dataset.theme")=='light'
  T.evaluate("go('reglages')");T.wait_for_timeout(200);T.check('input[name=theme][value=auto]',force=True);assert T.evaluate("document.documentElement.dataset.theme") is None
  assert 'budget-couple-theme' not in json.dumps(F.rows[nw]['data']),'thème jamais synchronisé';print('thème manuel OK');T.context.close()

  m=json.load(open(os.path.join(ROOT,'manifest-v2.webmanifest')));assert 'orientation' not in m;print('manifest sans orientation OK')
  print('ERREURS',errs);assert not errs,errs;print('ALERTES',alerts)
  b.close()
finally:srv.kill()
print('V13 OK')
