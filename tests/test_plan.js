const a=require('assert'),P=require('../plan.js');
// 1) charges annuelles
a.strictEqual(P.annualNext({month:10},'2026-10'),'2026-10');a.strictEqual(P.annualNext({month:9},'2026-10'),'2027-09');a.strictEqual(P.annualNext({month:10,paidYear:2026},'2026-10'),'2027-10');
let p=P.annualPlan({amount:1200,month:10,saved:0,split:60},'2026-10');a.strictEqual(p.months,1);a.strictEqual(p.monthly,1200);a.deepStrictEqual(p.per,{p1:720,p2:480});
p=P.annualPlan({amount:1000,month:4,saved:100,split:50},'2026-10');a.strictEqual(p.due,'2027-04');a.strictEqual(p.months,6);a.strictEqual(p.monthly,150);
p=P.annualPlan({amount:100,month:1,saved:0},'2026-10');a.strictEqual(p.months,3);a.strictEqual(p.monthly,33.34);a.ok(p.monthly*3>=100);
p=P.annualPlan({amount:300,month:12,saved:400},'2026-10');a.ok(p.ready);a.strictEqual(p.monthly,0);a.strictEqual(p.pct,100);
p=P.annualPlan({amount:1200,month:10,paidYear:2026},'2026-10');a.strictEqual(p.months,12);a.strictEqual(p.monthly,100);a.strictEqual(p.smoothed,100);
a.deepStrictEqual(P.annualTotals([],'2026-10').monthly,0);
// 2) précaution
a.strictEqual(P.precaution(0,0).level,'none');a.strictEqual(P.precaution(500,1000).level,'critical');a.strictEqual(P.precaution(2500,1000).level,'low');
a.strictEqual(P.precaution(4000,1000).level,'ok');a.strictEqual(P.precaution(9000,1000).level,'high');a.strictEqual(P.precaution(2500,1000).gap,500);
// 3) crédits : 100 000 € à 3 % sur 240 mois → 554,60 €
a.strictEqual(P.loanPayment(100000,3,240),554.6);
let S=P.loanSchedule({principal:100000,rate:3,months:240,start:'2020-01',insurance:20});a.strictEqual(S.count,240);a.strictEqual(S.end,'2039-12');
a.strictEqual(S.rows[S.rows.length-1].cap,0);const sumPrinc=S.rows.reduce((s,x)=>s+Math.round(x.princ*100),0);a.strictEqual(sumPrinc,10000000);
a.ok(Math.abs(S.totalInterest-33104)<5,S.totalInterest);a.strictEqual(S.totalInsurance,4800);a.strictEqual(S.rows[0].int,250);
let st=P.loanStatus({principal:100000,rate:3,months:240,start:'2020-01'},'2026-10');a.strictEqual(st.paidCount,82);a.strictEqual(st.left,158);a.ok(st.remaining>70000&&st.remaining<75000,st.remaining);
a.strictEqual(P.loanStatus({principal:1000,rate:3,months:12,start:'2027-01'},'2026-10').remaining,1000);
a.ok(P.loanStatus({principal:1000,rate:3,months:12,start:'2020-01'},'2026-10').done);
S=P.loanSchedule({principal:1200,rate:0,months:12,start:'2026-01'});a.strictEqual(S.payment,100);a.strictEqual(S.totalInterest,0);a.strictEqual(S.count,12);
S=P.loanSchedule({principal:10000,rate:5,months:12,start:'2026-01',payment:40});a.ok(S.error);a.strictEqual(S.rows.length,0);
S=P.loanSchedule({principal:10000,rate:2,months:60,start:'2026-01',payment:500});a.ok(S.count<60&&!S.error&&S.rows[S.rows.length-1].cap===0);
a.ok(P.loanSchedule({principal:0,months:12,start:'2026-01'}).error);a.ok(P.loanSchedule({principal:10,months:12}).error);
const Y=P.loanYears(P.loanSchedule({principal:1200,rate:0,months:12,start:'2026-07'}));a.deepStrictEqual(Y.map(y=>y.year),['2026','2027']);a.strictEqual(Y[0].princ,600);a.strictEqual(Y[1].cap,0);
// 4) patrimoine
const W=P.netWorth([{owner:'p1',value:1000.1},{owner:'joint',value:500},{owner:'p2',value:200.2}],[{owner:'common',value:300}]);
a.deepStrictEqual(W.net,{p1:1000.1,p2:200.2,common:200,total:1400.3});a.strictEqual(W.assets.total,1700.3);
// 5) abonnements
const m=(id,date,label,amount,o={})=>({id,date,label,amount,source:'import',category:'loisirs',...o});
const misc=[m('1','2026-06-05','PRLV SEPA NETFLIX.COM',13.49),m('2','2026-07-05','PRLV SEPA NETFLIX.COM',13.49),m('3','2026-08-05','PRLV SEPA NETFLIX.COM',13.49),m('4','2026-09-05','PRLV SEPA NETFLIX.COM',15.99),
 m('5','2026-07-02','CB CARREFOUR',54.2),m('6','2026-07-19','CB CARREFOUR',81),m('7','2026-08-03','CB CARREFOUR',22),
 m('8','2026-06-10','PRLV FREE MOBILE',19.99),m('9','2026-07-10','PRLV FREE MOBILE',19.99),m('10','2026-08-10','PRLV FREE MOBILE',19.99),m('11','2026-09-10','PRLV FREE MOBILE',19.99),
 m('12','2025-10-01','PRLV AMAZON PRIME',69.9),m('13','2026-10-01','PRLV AMAZON PRIME',69.9),
 m('14','2026-01-03','PRLV SALLE SPORT',30),m('15','2026-02-03','PRLV SALLE SPORT',30),m('16','2026-03-03','PRLV SALLE SPORT',30),
 m('17','2026-07-01','Saisie main NETFLIX',13.49,{source:undefined})];
let R=P.detectSubs(misc,[{id:'f1',label:'Forfait Free mobile',amount:19.99}],[],'2026-10-12');const k=Object.fromEntries(R.list.map(s=>[s.key,s]));
a.ok(!Object.keys(k).some(x=>x.includes('carrefour')),'courses non régulières exclues');
const nf=R.list.find(s=>/netflix/.test(s.key));a.ok(nf&&nf.period==='mensuel'&&nf.count===4&&nf.rise&&nf.rise.from===13.49&&nf.rise.to===15.99&&nf.active);
const fr=R.list.find(s=>/free/.test(s.key));a.strictEqual(fr.fixedId,'f1');
const am=R.list.find(s=>/amazon/.test(s.key));a.ok(am.period==='annuel'&&am.monthly===5.83);
const sp=R.list.find(s=>/salle|sport/.test(s.key));a.ok(sp&&!sp.active,'arrêté depuis mars');
a.strictEqual(R.monthly,Math.round((15.99+5.83)*100)/100);a.strictEqual(R.rises.length,1);
R=P.detectSubs(misc,[],[{key:nf.key}],'2026-10-12');a.ok(R.list.find(s=>s.key===nf.key).ignored);a.strictEqual(R.rises.length,0);
a.deepStrictEqual(P.detectSubs([],[],[],'2026-10-12').list,[]);
// 6) bilan annuel
const d={ratio:60,misc:[{date:'2026-02-01',amount:100,category:'courses',for:'common'},{date:'2026-03-01',amount:50,category:'resto',for:'p1'},{date:'2025-03-01',amount:999,category:'resto',for:'p1'}],
 fixed:[{amount:1000,category:'logement'}],months:[{month:'2026-01',a:100,b:50},{month:'2026-02',a:100,b:50},{month:'2025-12',a:1,b:1}],
 placements:[{id:'la',type:'livretA',owner:'p1'},{id:'pe',type:'per',owner:'p2',monthly:100,name:'PER test'},{id:'pe2',type:'per',owner:'p1',monthly:50}],
 interests:[{pid:'la',year:2026,amount:42.5},{pid:'la',year:2026,amount:0,skipped:true},{pid:'la',year:2025,amount:9}],movements:[{pid:'pe2',date:'2026-05-02',amount:500},{pid:'pe2',date:'2026-06-02',amount:-20}]};
let B=P.yearReport(d,2026,'2026-10-12');a.strictEqual(B.months,10);a.deepStrictEqual(B.misc,{p1:50,p2:0,common:100,total:150});a.strictEqual(B.fixed,10000);a.deepStrictEqual(B.fixedShare,{p1:6000,p2:4000});
a.deepStrictEqual(B.savings,{p1:200,p2:100,total:300});a.strictEqual(B.interests.p1,42.5);a.strictEqual(B.per.p2,1000);a.strictEqual(B.per.p1,500);
a.ok(B.perList.find(x=>x.id==='pe').estimated&&!B.perList.find(x=>x.id==='pe2').estimated);a.strictEqual(B.categories[0].key,'courses');
B=P.yearReport(d,2025,'2026-10-12');a.strictEqual(B.months,12);a.strictEqual(B.misc.p1,999);a.strictEqual(P.yearReport(d,2027,'2026-10-12').fixed,0);
// 7) sauvegarde : restauration = ajout seulement
const S0=require('../store.js'),cur=S0.migrateData({version:13,names:{p1:'Alice',p2:'Bruno'},ratio:60,goals:[{id:'g1',name:'Actuel',target:100,u:5}],deleted:{g3:9}});
const bak=S0.migrateData({version:12,names:{p1:'Ancien',p2:'Nom'},ratio:50,reminderDay:3,goals:[{id:'g1',name:'Ancienne version',target:50},{id:'g2',name:'Nouveau',target:10},{id:'g3',name:'Supprimé depuis',target:1}],budget:{'2026-01':300}});
const B0=S0.blankData(),isDef=(k,v)=>v===undefined||v===null||JSON.stringify(v)===JSON.stringify(B0[k]);
const PL=P.restorePlan(cur,bak,S0.LISTS,['names','ratio','reminderDay'],isDef);a.deepStrictEqual(PL.add,[{list:'goals',id:'g2'}]);a.deepStrictEqual(PL.deleted,[{list:'goals',id:'g3'}]);a.strictEqual(PL.differs,1);
a.deepStrictEqual(PL.scal,['reminderDay']);a.deepStrictEqual(PL.budget,['2026-01']);
let out=P.applyRestore(cur,bak,PL,false);a.deepStrictEqual(out.goals.map(g=>g.name),['Actuel','Nouveau']);a.strictEqual(out.names.p1,'Alice');a.strictEqual(out.ratio,60);a.strictEqual(out.reminderDay,3);a.strictEqual(out.deleted.g3,9);
out=P.applyRestore(cur,bak,PL,true);a.ok(out.goals.some(g=>g.id==='g3')&&!out.deleted.g3);a.strictEqual(cur.goals.length,1,'entrée non modifiée');
a.ok(P.backupBody({a:1,miscMonth:'x'})==='{"a":1}');
console.log('plan v15 OK')
