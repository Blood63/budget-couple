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
