// Tests unitaires : migrations, fusion sans perte, ISIN. Lancer : node tests/test_store.js
const S=require('../store.js'),a=require('assert'),cl=o=>JSON.parse(JSON.stringify(o));
['US0378331005','FR0000120271','IE00B4L5Y983','LU0290358497','FR0010315770'].forEach(i=>a.ok(S.isinValid(i),i));
['US0378331006','FR000012027','1R0000120271','IE00B4L5Y984',''].forEach(i=>a.ok(!S.isinValid(i),i));
let b=S.migrateData({version:2,ratio:60,fixed:[{id:'f1',label:'Loyer',amount:900,payer:'common'}],misc:[{id:'x',date:'2026-10-01',label:'C',amount:10,payer:'common'}],placements:[{id:'p',name:'L',capital:1,monthly:0,rate:1}],updated:100});
a.equal(b.version,S.DATA_VERSION);a.equal(b.fixed[0].split,60);a.equal(b.fixed[0].paidBy,'joint');a.equal(b.misc[0].for,'common');a.equal(b.placements[0].type,'autre');a.equal(b.placements[0].u,100);
let A=cl(b),B=cl(b),sA=S.snapshot(A),sB=S.snapshot(B);
A.fixed[0].amount=950;A.misc.push({id:'a1',date:'2026-10-02',label:'A',amount:5});S.stamp(A,sA,200,'p1');
B.misc=B.misc.filter(x=>x.id!=='x');B.misc.push({id:'b1',date:'2026-10-03',label:'B',amount:7});B.ratio=55;B.fixed[0].label='Loyer+';S.stamp(B,sB,210,'p2');
const m1=S.mergeData(A,B),m2=S.mergeData(B,A);a.equal(S.canon(m1),S.canon(m2));
a.equal(m1.fixed[0].amount,950);a.equal(m1.fixed[0].label,'Loyer+');a.deepEqual(m1.misc.map(x=>x.id).sort(),['a1','b1']);a.equal(m1.ratio,55);
let C=cl(m1),E=cl(m1);C.fixed=[];S.stamp(C,S.snapshot(m1),300,'p1');E.fixed[0].amount=1000;S.stamp(E,S.snapshot(m1),310,'p2');
a.equal(S.mergeData(C,E).fixed[0].amount,1000);let F=cl(E);F.fixed=[];S.stamp(F,S.snapshot(E),400,'p1');a.equal(S.mergeData(E,F).fixed.length,0);
a.equal(S.canon(S.mergeData(m1,m1)),S.canon(m1));console.log('OK');
// v7 : impôt sur le revenu (barème 2026, revenus 2025) et migration
{const P=require('../rates.json').incomeTax;
 a.equal(S.irCompute(30000,1,0,P).net,2104);a.equal(S.irCompute(30000,1,0,P).tmi,30);
 const d=S.irCompute(20000,1,0,P);a.equal(d.brut,924);a.equal(d.decote,479);a.equal(d.net,445);
 a.equal(S.irCompute(60000,2,0,P).net,4208);a.equal(S.irCompute(5000,1,0,P).net,0);
 const q=S.irCompute(150000,2,2,P),noCap=S.irCompute(150000,2,0,P);a.ok(noCap.net-q.net<=2*2*1807+1,'quotient familial plafonné');
 a.equal(S.proDeduct(3000,P),509);a.equal(S.proDeduct(30000,P),3000);a.equal(S.proDeduct(200000,P),14555);
 const t=S.taxEstimate({p1:{sal:30000,other:0},p2:{sal:24000,other:0}},{mode:'separe',children:0},P);a.equal(t.sep.total,2265);a.equal(t.com.net,2575);
 const m=S.migrateData({version:6,placements:[]});a.equal(m.version,12);a.deepEqual(m.births,{p1:'2000-06-22',p2:'2002-03-10'});a.equal(m.tax.mode,'separe');a.deepEqual(m.dismissed,[]);
 const m2=S.migrateData(JSON.parse(JSON.stringify(m)));a.equal(S.canon(m2),S.canon(m));console.log('OK impôt + migration v7')}
/* v8 : comptes courants, assurances, intérêts, bilans */
{const a=require('assert'),S=require('../store.js');
 const v7={version:7,names:{p1:'Paul',p2:'Lucie'},ratio:50,fixed:[{id:'f1',label:'Loyer',amount:900,day:5,split:50,paidBy:'joint'},{id:'f2',label:'Mobile',amount:20,day:8,split:100,paidBy:'p1'}],
   incomes:[{id:'i1',person:'p1',type:'salaire',amount:2000,recurring:true},{id:'i2',person:'p2',type:'salaire',amount:1800,recurring:true}],misc:[],months:[],goals:[],placements:[],transfer:{amount:0}};
 const m=S.migrateData(JSON.parse(JSON.stringify(v7)));a.equal(m.version,12);
 a.deepEqual(m.accounts.map(x=>x.id).sort(),['acc-joint','acc-p1','acc-p2']);a.equal(m.fixed[0].account,'acc-joint');a.equal(m.fixed[1].account,'acc-p1');a.equal(m.incomes[1].account,'acc-p2');
 ['insurances','interests','movements','reports'].forEach(k=>a.deepEqual(m[k],[]));
 // deux appareils migrent indépendamment → données identiques ; la fusion ne duplique rien
 const m2=S.migrateData(JSON.parse(JSON.stringify(v7)));a.equal(S.canon(m),S.canon(m2));const mg=S.mergeData(m,m2);a.equal(mg.accounts.length,3);
 a.equal(S.canon(S.migrateData(JSON.parse(JSON.stringify(m)))),S.canon(m),'migration idempotente');
 // toutes les versions de départ
 for(const v of [undefined,1,2,3,4,5,6,7,8,9,10,11]){const d=S.migrateData({version:v,fixed:[{id:'x',label:'A',amount:10,day:3,split:50}],misc:[],goals:[]});a.equal(d.version,12,'depuis v'+v);a.ok(Array.isArray(d.accounts)&&Array.isArray(d.reports)&&Array.isArray(d.imports)&&Array.isArray(d.catrules),'listes v'+v);a.equal(d.fixed.length,1)}
 // données vides
 const e=S.migrateData({});a.equal(e.version,12);a.equal(e.accounts.length,0);
 // pas d'historique pour les bilans automatiques
 const snap=S.snapshot(e);e.reports.push({id:'rep-2026-09',month:'2026-09'});S.stamp(e,snap,1000,'p1');a.equal(e.history.length,0);
 console.log('OK migration v8 (toutes versions, 2 appareils)')}
{const m=S.migrateData({version:9,placements:[{id:'a',type:'av'},{id:'l',type:'livretA'}],insurances:[{id:'s',type:'sante'},{id:'h',type:'habitation',label:'Habitation maison propriétaire'}]});
 a.equal(m.version,12);a.equal(m.placements[0].contract,null);a.ok(!('contract' in m.placements[1]));a.equal(m.insurances[0].persons,1);a.equal(m.insurances[1].profile,'proprietaire');console.log('migration v9→v10 OK')}
{const g={id:'g',owner:'common',target:1000,name:'X'},m=S.migrateData({version:10,goals:[g,{id:'h',owner:'p1',target:5}],months:[{id:'m',month:'2026-01',a:10,b:5}]});
 a.equal(m.version,12);a.strictEqual(m.goals[0].split,null);a.equal(m.goals[0].target,1000);a.equal(m.months[0].a,10);console.log('migration v10→v11 OK')}
{const src={version:11,misc:[{id:'x',date:'2026-10-01',label:'A',amount:5,paidBy:'p1',payer:'common',for:'common'}],settlements:[{id:'s',month:'2026-09',from:'p2',to:'p1',amount:12}]},m=S.migrateData(JSON.parse(JSON.stringify(src)));
 a.equal(m.version,12);a.deepEqual(m.debts,[]);a.deepEqual(m.misc[0],src.misc[0]);a.deepEqual(m.settlements[0],src.settlements[0]);
 const k=S.migrateData({version:11,debts:[{id:'d',from:'p1',to:'p2',amount:3}]});a.equal(k.debts.length,1);console.log('migration v11→v12 OK')}
