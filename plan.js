'use strict';
/* v15 : calculs purs (testés sous Node) — charges annuelles, précaution, crédits, patrimoine, abonnements, bilan annuel, sauvegarde. */
const _F=typeof module!=='undefined'&&typeof window==='undefined'?require('./finance.js'):{merchantKey:(...a)=>merchantKey(...a),labelSim:(...a)=>labelSim(...a),normLabel:(...a)=>normLabel(...a)};
const _r2=x=>Math.round((+x||0)*100)/100,_c=x=>Math.round((+x||0)*100);
const ymAdd=(ym,n)=>{const[y,m]=ym.split('-').map(Number),t=y*12+(m-1)+n;return `${Math.floor(t/12)}-${String(t%12+1).padStart(2,'0')}`};
const ymDiff=(a,b)=>{const[y1,m1]=a.split('-').map(Number),[y2,m2]=b.split('-').map(Number);return (y2-y1)*12+m2-m1}; // b − a
const ownKey=o=>o==='p1'||o==='p2'?o:'common';
/* 1) Charges annuelles lissées. a = {amount, month (1–12), saved (déjà provisionné), paidYear (dernière année payée), split (% personne 1)}
   Prochaine échéance : ce mois-ci ou plus tard dans l'année, sinon l'an prochain ; une échéance marquée payée passe à l'année suivante.
   Mois de provision = mois restants avant l'échéance (au moins 1) ; mensuel = (montant − provisionné) ÷ mois, arrondi au centime supérieur. */
function annualNext(a,cm){const[y,m]=cm.split('-').map(Number),mo=Math.min(12,Math.max(1,Math.round(+a.month||1)));let Y=mo>=m?y:y+1;if(+a.paidYear>=Y)Y=+a.paidYear+1;return `${Y}-${String(mo).padStart(2,'0')}`}
function annualPlan(a,cm){const amt=_c(a.amount),saved=Math.max(0,_c(a.saved)),due=annualNext(a,cm),months=Math.max(1,ymDiff(cm,due)),rest=Math.max(0,amt-saved);
  const monthly=rest?Math.ceil(rest/months)/100:0,sp=Math.min(100,Math.max(0,a.split==null?50:+a.split)),p1=Math.round(monthly*sp)/100;
  return{due,months,inMonths:ymDiff(cm,due),amount:amt/100,saved:saved/100,rest:rest/100,monthly,smoothed:Math.ceil(amt/12)/100,ready:!rest,pct:amt?Math.min(100,saved/amt*100):100,per:{p1,p2:_r2(monthly-p1)}}}
function annualTotals(list,cm){const t={monthly:0,p1:0,p2:0,smoothed:0,year:0};(list||[]).forEach(a=>{const p=annualPlan(a,cm);t.monthly+=_c(p.monthly);t.p1+=_c(p.per.p1);t.p2+=_c(p.per.p2);t.smoothed+=_c(p.smoothed);t.year+=_c(p.amount)});
  Object.keys(t).forEach(k=>t[k]/=100);return t}
/* 2) Épargne de précaution : mois de dépenses couverts par l'épargne disponible (livrets). Repère usuel : 3 à 6 mois. */
function precaution(available,monthly){available=Math.max(0,+available||0);monthly=Math.max(0,+monthly||0);
  if(!monthly)return{months:null,level:'none',available,monthly,low:0,high:0};const months=available/monthly;
  return{months,level:months<1?'critical':months<3?'low':months<=6?'ok':'high',available,monthly,low:_r2(monthly*3),high:_r2(monthly*6),gap:_r2(Math.max(0,monthly*3-available))}}
/* 3) Crédits amortissables (échéances constantes). l = {principal, rate (% annuel), months, start 'AAAA-MM' (1re échéance), payment (facultatif), insurance (€/mois)} */
function loanPayment(P,rate,n){P=+P||0;n=Math.max(1,Math.round(+n||1));const i=(+rate||0)/1200;return _r2(i?P*i/(1-Math.pow(1+i,-n)):P/n)}
function loanSchedule(l){const P=_r2(l.principal),n=Math.max(1,Math.round(+l.months||1)),i=(+l.rate||0)/1200,auto=!(+l.payment>0),pay=auto?loanPayment(P,l.rate,n):_r2(l.payment),ins=_r2(l.insurance),start=/^\d{4}-\d{2}/.test(l.start||'')?l.start.slice(0,7):null;
  if(!P||!start)return{rows:[],payment:pay,error:!P?'Capital manquant':'Date de début manquante'};
  if(_r2(P*i)>=pay)return{rows:[],payment:pay,error:'La mensualité ne couvre pas les intérêts : vérifiez le taux et la mensualité.'};
  const rows=[];let cap=P,ti=0;const max=auto?n:1200;
  for(let k=0;k<max&&cap>0.004;k++){const int=_r2(cap*i);let princ=_r2(pay-int);if(princ>cap||(auto&&k===n-1))princ=cap;cap=_r2(cap-princ);ti+=_c(int);rows.push({k:k+1,month:ymAdd(start,k),pay:_r2(int+princ),int,princ,ins,cap})}
  const last=rows[rows.length-1];return{rows,payment:pay,insurance:ins,end:last.month,count:rows.length,totalInterest:ti/100,totalInsurance:_r2(ins*rows.length),totalCost:_r2(ti/100+ins*rows.length),error:cap>0.004?'Durée trop longue (plus de 100 ans)':null}}
/* capital restant dû après les échéances passées jusqu'au mois cm inclus */
function loanRemaining(S,P,cm){if(!S.rows.length)return _r2(P);if(cm<S.rows[0].month)return _r2(P);let r=_r2(P);for(const x of S.rows){if(x.month>cm)break;r=x.cap}return r}
function loanStatus(l,cm){const S=loanSchedule(l),rem=loanRemaining(S,l.principal,cm),paid=S.rows.filter(x=>x.month<=cm),left=S.rows.length-paid.length;
  return{...S,remaining:rem,paidCount:paid.length,left,interestLeft:_r2(S.rows.filter(x=>x.month>cm).reduce((s,x)=>s+x.int,0)),done:!!S.rows.length&&left===0,pct:+l.principal>0?Math.min(100,(1-rem/(+l.principal))*100):0}}
function loanYears(S){const Y={};S.rows.forEach(x=>{const y=x.month.slice(0,4),o=Y[y]||(Y[y]={year:y,pay:0,int:0,princ:0,ins:0,cap:0});o.pay+=_c(x.pay);o.int+=_c(x.int);o.princ+=_c(x.princ);o.ins+=_c(x.ins);o.cap=x.cap});
  return Object.values(Y).map(o=>({year:o.year,pay:o.pay/100,int:o.int/100,princ:o.princ/100,ins:o.ins/100,cap:o.cap}))}
/* 4) Patrimoine net. assets / debts = [{owner:'p1'|'p2'|'common'|'joint', value}] */
function netWorth(assets,debts){const z=()=>({p1:0,p2:0,common:0,total:0}),A=z(),Dt=z(),add=(o,L)=>L.forEach(x=>{const v=_c(x.value);if(!isFinite(v))return;o[ownKey(x.owner)]+=v;o.total+=v});add(A,assets||[]);add(Dt,debts||[]);
  const N=z();Object.keys(N).forEach(k=>N[k]=(A[k]-Dt[k])/100);Object.keys(A).forEach(k=>{A[k]/=100;Dt[k]/=100});return{assets:A,debts:Dt,net:N}}
/* 5) Abonnements : opérations importées récurrentes (même marchand, montant proche, périodicité régulière). */
const PERIODS=[['mensuel',30.44,22,40,3],['trimestriel',91.3,80,102,2],['annuel',365.25,345,385,2]];
const _days=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/864e5);
const _med=L=>{const s=[...L].sort((a,b)=>a-b),h=s.length>>1;return s.length%2?s[h]:(s[h-1]+s[h])/2};
const subKey=label=>{const k=_F.merchantKey(label||'')||_F.normLabel(label||'').slice(0,24);return k?k.toLowerCase():''};
function detectSubs(misc,fixed,off,today){const ign=new Set((off||[]).map(x=>x.key)),G=new Map();
  (misc||[]).filter(x=>x.source==='import'&&+x.amount>0&&x.date).forEach(x=>{const k=subKey(x.label);if(!k)return;if(!G.has(k))G.set(k,[]);G.get(k).push(x)});
  const out=[];G.forEach((L,key)=>{const byDay=new Map();L.forEach(x=>{if(!byDay.has(x.date))byDay.set(x.date,x)});const S=[...byDay.values()].sort((a,b)=>a.date.localeCompare(b.date));if(S.length<2)return;
    const iv=S.slice(1).map((x,i)=>_days(S[i].date,x.date)),P=PERIODS.find(([,,lo,hi,min])=>S.length>=min&&iv.every(d=>d>=lo&&d<=hi));if(!P)return;
    const amts=S.map(x=>+x.amount),med=_med(amts);if(!amts.every(a=>Math.abs(a-med)<=Math.max(2,med*0.25)))return;
    const last=S[S.length-1],prev=S[S.length-2],rise=last.amount-prev.amount>Math.max(0.5,prev.amount*0.02)?{from:_r2(prev.amount),to:_r2(last.amount),pct:(last.amount-prev.amount)/prev.amount*100}:null;
    const active=_days(last.date,today)<=P[3]+10,inFixed=(fixed||[]).find(f=>_F.labelSim(f.label||'',last.label)>=0.5&&Math.abs((+f.amount||0)-last.amount)<=Math.max(1.5,last.amount*0.2))||null;
    out.push({key,label:last.label,period:P[0],count:S.length,last:last.date,amount:_r2(last.amount),monthly:_r2(last.amount*30.44/P[1]),yearly:_r2(last.amount*365.25/P[1]),rise,active,ignored:ign.has(key),fixedId:inFixed?inFixed.id:null,category:last.category||'autre'})});
  const counted=out.filter(s=>s.active&&!s.ignored&&!s.fixedId);
  return{list:out.sort((a,b)=>b.monthly-a.monthly),monthly:counted.reduce((t,s)=>t+_c(s.monthly),0)/100,yearly:counted.reduce((t,s)=>t+_c(s.yearly),0)/100,rises:counted.filter(s=>s.rise),counted:counted.length}}
/* 6) Bilan d'une année civile. d = données ; opts = {today:'AAAA-MM-JJ', placValue:fn(p)} */
function yearReport(d,Y,today){Y=String(Y);const cm=today.slice(0,7),nMonths=Y<cm.slice(0,4)?12:Y===cm.slice(0,4)?+cm.slice(5,7):0,ratio=typeof d.ratio==='number'?d.ratio:50;
  const z=()=>({p1:0,p2:0,common:0,total:0}),cats={},per=z(),addP=(o,w,v)=>{o[ownKey(w)]+=v;o.total+=v};
  (d.misc||[]).filter(x=>(x.date||'').startsWith(Y)).forEach(x=>{const v=_c(x.amount),c=x.category||'autre';cats[c]=(cats[c]||0)+v;addP(per,x.for||x.payer||'common',v)});
  const fixedM=(d.fixed||[]).reduce((s,f)=>s+_c(f.amount),0),fixed=fixedM*nMonths,fcat={};(d.fixed||[]).forEach(f=>{fcat[f.category||'autre']=(fcat[f.category||'autre']||0)+_c(f.amount)*nMonths});
  const sav={p1:0,p2:0,total:0};(d.months||[]).filter(m=>(m.month||'').startsWith(Y)).forEach(m=>{sav.p1+=_c(m.a);sav.p2+=_c(m.b)});sav.total=sav.p1+sav.p2;
  const pl=id=>(d.placements||[]).find(p=>p.id===id),ints=z();(d.interests||[]).filter(i=>String(i.year)===Y&&!i.skipped).forEach(i=>addP(ints,(pl(i.pid)||{}).owner,_c(i.amount)));
  const per1=z(),perL=[];(d.placements||[]).filter(p=>p.type==='per').forEach(p=>{const mv=(d.movements||[]).filter(x=>x.pid===p.id&&(x.date||'').startsWith(Y)&&+x.amount>0),est=!mv.length;
    const v=est?_c(p.monthly)*nMonths:mv.reduce((s,x)=>s+_c(x.amount),0);if(!v)return;addP(per1,p.owner,v);perL.push({id:p.id,name:p.name||'PER',owner:ownKey(p.owner),amount:v/100,estimated:est})});
  const n=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,v/100]));
  return{year:Y,months:nMonths,categories:Object.entries(cats).map(([k,v])=>({key:k,amount:v/100})).sort((a,b)=>b.amount-a.amount),misc:n(per),fixed:fixed/100,fixedCategories:Object.entries(fcat).filter(([,v])=>v).map(([k,v])=>({key:k,amount:v/100})).sort((a,b)=>b.amount-a.amount),
    fixedShare:{p1:Math.round(fixed*ratio/100)/100,p2:(fixed-Math.round(fixed*ratio/100))/100},savings:n(sav),interests:n(ints),per:n(per1),perList:perL}}
/* 7) Sauvegarde : enveloppe avec empreinte ; restauration = ajout seulement (rien d'existant n'est modifié ni supprimé). */
const BACKUP_FMT='budget-couple-backup';
function backupBody(d){const {miscMonth,...r}=d;return JSON.stringify(r)}
function countsOf(d,lists){return Object.fromEntries(lists.map(l=>[l,(d[l]||[]).length]))}
/* cur et bak déjà migrés ; isDef(k,v) = valeur par défaut ; lists / scal = clés connues */
function restorePlan(cur,bak,lists,scal,isDef){const P={add:[],deleted:[],differs:0,same:0,scal:[],budget:[]},sg=x=>{const {u,by,fu,c,...r}=x;return JSON.stringify(r)};
  lists.forEach(l=>{const M=new Map((cur[l]||[]).map(x=>[x.id,x]));(bak[l]||[]).forEach(x=>{if(!x||!x.id)return;const c=M.get(x.id);
    if(!c)(cur.deleted&&cur.deleted[x.id]?P.deleted:P.add).push({list:l,id:x.id});else if(sg(c)===sg(x))P.same++;else P.differs++})});
  scal.forEach(k=>{if(bak[k]!==undefined&&isDef(k,cur[k])&&!isDef(k,bak[k]))P.scal.push(k)});
  Object.keys(bak.budget||{}).forEach(m=>{if(!(m in (cur.budget||{})))P.budget.push(m)});return P}
function applyRestore(cur,bak,P,withDeleted){const r=JSON.parse(JSON.stringify(cur)),B=new Map();Object.keys(bak).forEach(l=>{if(Array.isArray(bak[l]))bak[l].forEach(x=>x&&x.id&&B.set(l+'\u0001'+x.id,x))});
  const take=e=>{const x=B.get(e.list+'\u0001'+e.id);if(!x||(r[e.list]||[]).some(y=>y.id===e.id))return;const {u,by,fu,...o}=JSON.parse(JSON.stringify(x));(r[e.list]=r[e.list]||[]).push(o)};
  P.add.forEach(take);if(withDeleted)P.deleted.forEach(e=>{delete r.deleted[e.id];take(e)});
  P.scal.forEach(k=>r[k]=JSON.parse(JSON.stringify(bak[k])));P.budget.forEach(m=>{r.budget[m]=bak.budget[m]});return r}
if(typeof module!=='undefined')module.exports={ymAdd,ymDiff,annualNext,annualPlan,annualTotals,precaution,loanPayment,loanSchedule,loanRemaining,loanStatus,loanYears,netWorth,detectSubs,subKey,yearReport,backupBody,countsOf,restorePlan,applyRestore,BACKUP_FMT};
