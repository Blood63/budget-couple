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
