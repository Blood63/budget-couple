const a=require('assert'),F=require('../finance.js'),rates=require('../rates.json');
// Livret A 2026 : taux 1,7 % (janv.), 1,5 % (févr.-juil.), 1,7 % (août-déc.) — règle des quinzaines
const p={id:'la',type:'livretA',capital:10000,open:{2026:10000}};
let r=F.livretInterest(p,2026,{rates,movements:[]});a.equal(r.amount,R(10000/24*(2*1.7+12*1.5+10*1.7)/100));
function R(x){return Math.round(x*100)/100}
r=F.livretInterest(p,2026,{rates,movements:[{pid:'la',date:'2026-03-10',amount:1000}]});a.equal(r.amount,R(10000/24*(2*1.7+12*1.5+10*1.7)/100+1000/24*(9*1.5+10*1.7)/100));
r=F.livretInterest(p,2026,{rates,movements:[{pid:'la',date:'2026-03-16',amount:1000}]});a.equal(r.amount,R(10000/24*38.4/100+1000/24*(8*1.5+10*1.7)/100),'dépôt le 16 → valeur le 1er du mois suivant');
r=F.livretInterest(p,2026,{rates,movements:[{pid:'la',date:'2026-11-20',amount:-500}]});a.equal(r.amount,R(10000/24*38.4/100-500/24*3*1.7/100),'retrait le 20 → perd la quinzaine du 16');
r=F.livretInterest(p,2026,{rates,movements:[{pid:'la',date:'2026-11-05',amount:-500}]});a.equal(r.amount,R(10000/24*38.4/100-500/24*4*1.7/100),'retrait le 5 → perd dès le 1er');
// versements programmés + solde d'ouverture estimé à partir du solde actuel
const q={id:'q',type:'ldds',capital:1300,capitalDate:'2026-03-20',monthly:100,payDay:5};
r=F.livretInterest(q,2026,{rates,movements:[]});a.equal(r.B0,1000);a.ok(r.estimatedB0);a.equal(r.end,2200);
// PEL : taux fixe du contrat
r=F.livretInterest({id:'pe',type:'pel',rate:2,open:{2026:2400}},2026,{rates,movements:[]});a.equal(r.amount,48);
// Comptes : prévision et découvert
const D={accounts:[{id:'acc-p1',owner:'p1',balance:200,balanceDate:'2026-10-02'}],incomes:[{account:'acc-p1',amount:2000,recurring:true,day:28}],
 fixed:[{account:'acc-p1',amount:800,day:5,label:'Loyer'},{account:'acc-p1',amount:50,day:1}],misc:[{date:'2026-10-10',amount:30,paidBy:'p1'}],months:[],transfer:{amount:0}};
let f=F.accountForecast(D,D.accounts[0],'2026-10','2026-10-02');a.equal(f.inn,2000);a.equal(f.out,880);a.equal(f.min,-630);a.equal(f.minDay,10);a.ok(f.risk);a.equal(f.end,1370);
f=F.accountForecast(D,D.accounts[0],'2026-11','2026-10-02');a.equal(f.start,1370);a.equal(f.end,1370+2000-850);
const D2={...D,accounts:[{id:'acc-p1',owner:'p1'}]};f=F.accountForecast(D2,D2.accounts[0],'2026-10');a.ok(!f.hasBalance);a.equal(f.needed,880);
{const D3={names:{p1:'Paul',p2:'Lucie'},accounts:[{id:'acc-p1',owner:'p1'},{id:'acc-joint',owner:'joint'}],incomes:[],fixed:[],misc:[],months:[],transfer:{},placements:[{id:'pl1',type:'livretA',name:'Livret Paul',owner:'p1',monthly:100,payDay:5},{id:'pl2',type:'av',name:'AV commune',owner:'common',monthly:150}]};
 const fp=F.accountForecast(D3,D3.accounts[0],'2027-02');a.equal(fp.out,100);a.ok(fp.events.some(e=>e.kind==='saving-planned'&&e.day===5));
 const fj=F.accountForecast(D3,D3.accounts[1],'2027-02');a.equal(fj.out,150);
 const D4={...D3,months:[{id:'m',month:'2027-02',a:500,b:0}]};const fs=F.accountForecast(D4,D4.accounts[0],'2027-02');a.equal(fs.out,500);a.ok(!fs.events.some(e=>e.kind==='saving-planned'));console.log('OK versements programmés en prévision future (sans double comptage)')}
// Assurances : extraction
const T=`MAIF - Assurance habitation Raqvam\nN° de contrat : 1234567 H\nSociétaire : Emilien Exemple et Julie Exemple\nAdresse du risque : 12 rue des Exemples, 63000 Clermont-Ferrand\nDate d'effet : 01/03/2025\nÉchéance principale : 01/03\nCotisation annuelle TTC : 312,48 €\nContrat renouvelé par tacite reconduction.\nGaranties\n- Responsabilité civile vie privée\n- Dégâts des eaux\n- Incendie\n- Vol et vandalisme\nFranchises\nFranchise générale : 150 €\nPlafonds\nMobilier assuré dans la limite de 25 000 €\nExclusions\n- Dommages intentionnels\nAssistance 24h/24 : 05 49 77 47 78\n`;
const o=F.insuranceExtract(T);a.equal(o.insurer,'MAIF');a.equal(o.contract,'1234567 H');a.equal(o.type,'habitation');a.equal(o.premium,312.48);a.equal(o.premiumFreq,'an');a.equal(o.start,'2025-03-01');a.equal(o.end,'--03-01');
a.ok(o.guarantees.includes('Dégâts des eaux'));a.ok(o.franchise.includes('150'));a.ok(o.ceilings.includes('25 000'));a.ok(o.exclusions.includes('intentionnels'));a.equal(o.phone,'05 49 77 47 78');a.ok(o.tacit);a.ok(o.object.includes('Clermont'));
a.equal(F.nextDue(o,'2026-10-14'),'2027-03-01');a.ok(F.cancelInfo(o,'2026-10-14').ok);
const A=F.insuranceExtract(`AXA Assurance auto\nNuméro de contrat : AX-99887766\nVéhicule assuré : Peugeot 208\nImmatriculation : AB-123-CD\nCotisation mensuelle : 48,90 €\nDate d'effet : 15 septembre 2026\nÉchéance : 15/09/2027\nSinistre : 01 23 45 67 89`);
a.equal(A.insurer,'AXA');a.equal(A.contract,'AX-99887766');a.equal(A.type,'auto');a.equal(A.premium,48.9);a.equal(A.premiumFreq,'mois');a.equal(A.start,'2026-09-15');a.equal(A.end,'2027-09-15');a.ok(A.object.includes('AB-123-CD'));
a.equal(F.cancelInfo(A,'2026-10-14').ok,false);
console.log('OK finance');
{const D={names:{p1:'E',p2:'J'},accounts:[{id:'acc-joint',owner:'joint',feed:{p1:600,p2:500,day:2}},{id:'acc-p1',owner:'p1'},{id:'acc-p2',owner:'p2'}],incomes:[],fixed:[{account:'acc-joint',amount:1100,day:5}],misc:[],months:[],transfer:{}};
 const j=F.accountForecast(D,D.accounts[0],'2026-10');a.equal(j.inn,1100);a.equal(j.out,1100);a.ok(!j.risk);const e=F.accountForecast(D,D.accounts[1],'2026-10');a.equal(e.out,600);console.log('OK alimentation compte joint')}
{const a=require('assert'),F=require('../finance.js');const o=F.insuranceExtract("MACIF\nÉchéance principale : 1er mars\nDate d'effet : 12 avril 2024\nVéhicule : Clio immatriculée AB-123-CD");
 a.equal(o.end,'--03-01');a.equal(o.start,'2024-04-12');a.equal(o.object,'Clio immatriculée AB-123-CD');console.log('OK dates en toutes lettres')}
/* Relevés : CSV (BNP, Crédit Mutuel, Boursorama), OFX, QIF, rapprochement */
{const a=require('assert'),F=require('../finance.js'),fs=require('fs'),path=require('path'),fx=n=>path.join(__dirname,'fixtures',n);
 const iconv=b=>new TextDecoder('windows-1252').decode(b);
 const sets={bnp:F.parseStatementText('x.csv',fs.readFileSync(fx('releve-bnp-fictif.csv'),'utf8')),cm:F.parseStatementText('x.csv',iconv(fs.readFileSync(fx('releve-creditmutuel-fictif.csv')))),
   bourso:F.parseStatementText('x.csv',fs.readFileSync(fx('releve-boursorama-fictif.csv'),'utf8')),ofx:F.parseStatementText('x.ofx',fs.readFileSync(fx('releve-fictif.ofx'),'utf8')),qif:F.parseStatementText('x.qif',fs.readFileSync(fx('releve-fictif.qif'),'utf8'))};
 for(const [k,s] of Object.entries(sets)){a.equal(s.ops.length,17,k);a.equal(s.ops[2].date,'2026-09-03',k);a.equal(s.ops[2].amount,-54.2,k);a.equal(s.ops[0].amount,900,k);a.ok(/CARREFOUR/.test(s.ops[2].label),k);
   a.equal(Math.round(s.ops.reduce((t,o)=>t+o.amount,0)*100)/100,32.87,k+' total')}
 const D={names:{p1:'Paul',p2:'Lucie'},accounts:[{id:'acc-joint',label:'Compte joint',owner:'joint',feed:{p1:900,p2:800,day:1}},{id:'acc-p1',label:'Compte Paul',owner:'p1'}],
   fixed:[{id:'f1',label:'Loyer',amount:950,day:5,account:'acc-joint'},{id:'f2',label:'Électricité EDF',amount:75,day:8,account:'acc-joint'},{id:'f3',label:'Forfait Free',amount:19.99,day:12,account:'acc-joint'}],
   incomes:[],placements:[{id:'p',type:'livretA',monthly:100}],transfer:{amount:0}};
 const T=sets.bnp.ops.map(o=>[o.label.slice(0,22),F.classifyOp(o,D,'acc-joint',{rules:[]})]),ty=i=>T[i][1].type;
 a.equal(ty(0),'virement');a.equal(ty(1),'virement');a.equal(ty(3),'charge');a.equal(T[3][1].fixedId,'f1');a.equal(T[5][1].fixedId,'f2');a.equal(T[6][1].fixedId,'f3');
 a.equal(ty(11),'epargne');a.equal(ty(16),'virement');a.equal(T[2][1].category,'courses');a.equal(T[4][1].category,'resto');a.equal(T[7][1].category,'shopping');a.equal(T[8][1].category,'transport');
 a.equal(T[9][1].category,'sante');a.equal(T[10][1].category,'loisirs');a.equal(T[14][1].category,'maison');a.equal(T[15][1].category,'autre');
 // apprentissage : règle apprise prioritaire
 a.equal(F.classifyOp(sets.bnp.ops[15],D,'acc-joint',{rules:[{key:F.merchantKey(sets.bnp.ops[15].label),category:'cadeaux'}]}).category,'cadeaux');
 // doublon : même hachage quel que soit le format
 a.equal(F.opHash(sets.bnp.ops[2]),F.opHash(sets.cm.ops[2]));
 // montants
 a.equal(F.frAmount('1 234,56'),1234.56);a.equal(F.frAmount('-0,99 €'),-0.99);a.equal(F.frAmount('(12,00)'),-12);a.equal(F.frAmount('1,234.50'),1234.5);
 // lignes PDF synthétiques : colonnes Débit / Crédit
 const L=[{items:[{str:'Date',x:10},{str:'Libellé',x:60},{str:'Débit',x:400,w:30},{str:'Crédit',x:480,w:30}]},{items:[{str:'03/09/2026',x:10},{str:'CB CARREFOUR',x:60},{str:'54,20',x:405,w:25}]},
   {items:[{str:'04/09/2026',x:10},{str:'VIR RECU',x:60},{str:'1 000,00',x:478,w:35}]},{items:[{str:'suite du libellé',x:60}]}];
 const P=F.parseStatementLines(L);a.deepEqual(P.map(o=>o.amount),[-54.2,1000]);a.equal(P[1].label,'VIR RECU suite du libellé');
 console.log('OK relevés (CSV ×3, OFX, QIF, PDF, rapprochement)')}
{const a=require('assert'),F=require('../finance.js');const M=Array.from({length:12},(_,i)=>({month:`2025-${String(i+1).padStart(2,'0')}`,a:100+i*10,b:50}));
 const s=F.savingsScenarios(M);a.equal(s.avg.m3.value,250);a.equal(s.avg.m12.value,205);a.equal(s.prudent,184.5);a.equal(s.realistic,220);
 const p=F.fiveYearProjection([{capital:10000,monthly:100,rate:1.7},{capital:5000,monthly:50,rate:5}],{monthsData:M,cashRate:1.7});
 a.equal(p.initial,15000);a.equal(p.programmed,150);a.equal(p.realistic.series.length,61);a.ok(p.realistic.end.total>p.prudent.end.total);a.equal(p.realistic.end.contributions,p.realistic.flow*60);
 a.ok(Math.abs(p.realistic.end.total-p.realistic.end.placements-p.realistic.end.cash)<0.02);console.log('OK scénarios + projection 5 ans')}
{const a=require('assert'),F=require('../finance.js'),fs=require('fs'),path=require('path'),fx=n=>path.join(__dirname,'fixtures',n),dec=b=>new TextDecoder('windows-1252').decode(b);
 const v1=F.parseStatementText('x.csv',fs.readFileSync(fx('releve-variante-virgules.csv'),'utf8')).ops;a.equal(v1.length,3);a.ok(v1[1].label.includes('PARIS 15'));a.ok(v1[2].label.includes('special'));
 const v0=F.parseStatementText('x.csv',fs.readFileSync(fx('releve-variante-preambule.csv'),'utf8')).ops;a.deepEqual(v0.map(o=>o.amount),[900,-54.2]);
 const v2=F.parseStatementText('x.csv',fs.readFileSync(fx('releve-variante-sans-entete.csv'),'utf8')).ops;a.deepEqual(v2.map(o=>o.amount),[900,-54.2,-129]);
 const v3=F.parseStatementText('x.csv',dec(fs.readFileSync(fx('releve-variante-debit-credit.csv')))).ops;a.deepEqual(v3.map(o=>[o.date,o.amount]),[['2026-09-01',900],['2026-09-03',-54.2],['2026-09-04',-129]]);
 const v4=F.parseStatementText('x.ofx',fs.readFileSync(fx('releve-variante.ofx'),'utf8')).ops;a.equal(v4.length,2);a.equal(v4[0].label,'VIR PAUL & CIE EXEMPLE');a.equal(v4[1].amount,-54.2);
 const v5=F.parseStatementText('x.qif',fs.readFileSync(fx('releve-variante.qif'),'utf8')).ops;a.deepEqual(v5.map(o=>o.amount),[-1234.56,2500]);
 const L=[{items:[{str:'Date',x:10},{str:'Libellé',x:60},{str:'Montant',x:400,w:40}]},{items:[{str:'03/09/2026',x:10},{str:'CB TEST',x:60},{str:'-54,20',x:405,w:30}]},{items:[{str:'ligne suite',x:60}]},{items:[{str:'04/09/2026',x:10},{str:'CB IKEA',x:60},{str:'(129,00)',x:405,w:35}]}];
 const P=F.parseStatementLines(L);a.equal(P[0].label,'CB TEST ligne suite');a.equal(P[1].amount,-129);console.log('OK variantes relevés fictives')}
{const a=require('assert'),F=require('../finance.js');
 // Plafond de versement : livret presque plein (solde pris comme base), excédent en poche libre, gains non inventés
 let p=F.fiveYearProjection([{capital:22900,monthly:100,rate:0,cap:22950,depBase:22900}],{months:3,monthsData:[],realistic:100,prudent:100,asOf:'2026-10-17'});
 a.equal(p.realistic.series[1].placements,22950);a.equal(p.realistic.series[1].cash,50);a.equal(p.realistic.series[3].cash,250);a.equal(p.realistic.series[3].total,23200);a.equal(p.realistic.series[3].gains,0);
 // PEA : plafond sur les versements (150 000), pas sur la valorisation
 p=F.fiveYearProjection([{capital:160000,monthly:100,rate:0,cap:150000,depBase:149950}],{months:2,monthsData:[],realistic:100,prudent:100,asOf:'2026-10-17'});
 a.equal(p.realistic.series[2].placements,160050);a.equal(p.realistic.series[2].cash,150);
 // PEL ouvert depuis mars 2011 : plus de versement après 10 ans, excédent en poche libre
 p=F.fiveYearProjection([{capital:1000,monthly:45,rate:0,cap:61200,depBase:1000,depositUntil:'2025-05-01'}],{months:2,monthsData:[],realistic:45,prudent:45,asOf:'2026-10-17'});
 a.equal(p.realistic.series[2].placements,1000);a.equal(p.realistic.series[2].cash,90);
 // Dates locales : à 00:30 à Paris le 1er novembre, UTC est encore le 31 octobre
 const d=new Date('2026-07-31T22:30:00Z');a.equal(F.localIso(d),'2026-08-01');a.equal(F.localMonth(d),'2026-08');console.log('OK plafonds/poche libre + dates locales')}
{const a=require('assert'),F=require('../finance.js');
 const s=F.safeToSpend({budget:500,spent:212.8,day:17,daysInMonth:31});a.equal(s.remaining,287.2);a.equal(s.daysLeft,15);a.equal(s.perDay,19.15);a.equal(s.projection,388.05);a.equal(s.status,'ok');
 const r=F.safeToSpend({budget:300,spent:290,day:28,daysInMonth:31});a.equal(r.status,'risk');a.ok(r.projection>300);
 const o=F.safeToSpend({budget:300,spent:350,day:10,daysInMonth:31});a.equal(o.status,'over');a.equal(o.over,50);a.equal(o.perDay,0);
 a.equal(F.safeToSpend({budget:0,spent:10,day:10,daysInMonth:31}).status,'no-budget');console.log('OK safe to spend')}
/* v13 : plafonds par catégorie */
{const F=require('../finance.js'),misc=[{date:'2026-10-02',category:'resto',amount:60},{date:'2026-10-05',category:'resto',amount:50},{date:'2026-10-03',category:'courses',amount:100},{date:'2026-09-30',category:'resto',amount:999},{date:'2026-10-04',amount:30}];
 const L=F.categoryCaps(misc,'2026-10',{resto:100,courses:400,autre:200,loisirs:0},10,31);
 a.deepEqual(L.map(c=>c.key),['resto','courses','autre'],'tri urgence, plafond 0 ignoré');
 a.equal(L[0].status,'over');a.equal(L[0].left,-10);a.equal(L[0].spent,110);
 a.equal(L[1].status,'ok');a.equal(L[1].left,300);a.equal(L[1].perDay,13.64);
 a.equal(L[2].spent,30,'sans catégorie = autre');
 a.equal(F.categoryCaps(misc,'2026-10',{courses:150},10,31)[0].status,'risk','projection 310 > 150');
 a.equal(F.categoryCaps(misc,'2026-10',{courses:120},31,31)[0].status,'near');
 a.deepEqual(F.categoryCaps(misc,'2026-10',undefined,1,31),[]);console.log('plafonds par catégorie OK')}
