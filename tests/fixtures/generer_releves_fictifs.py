"""Relevés de compte FICTIFS (mise en page type BNP / Crédit Mutuel / Boursorama) en PDF, CSV, OFX et QIF. Aucune donnée réelle."""
import os,sys
from playwright.sync_api import sync_playwright
OUT=sys.argv[1] if len(sys.argv)>1 else os.path.dirname(os.path.abspath(__file__))
OPS=[("01/09","VIR SEPA RECU /DE PAUL EXEMPLE /MOTIF ALIMENTATION",900.00),("01/09","VIR SEPA RECU /DE LUCIE EXEMPLE /MOTIF ALIMENTATION",800.00),
 ("03/09","CB CARREFOUR MARKET 02/09",-54.20),("05/09","PRLV SEPA FONCIA GESTION LOYER",-950.00),("06/09","CB BOULANGERIE DU CENTRE 05/09",-8.60),
 ("08/09","PRLV SEPA EDF CLIENTS PARTICULIERS",-78.40),("12/09","PRLV SEPA FREE MOBILE",-19.99),("12/09","CB AMAZON PAYMENTS 11/09",-32.99),
 ("14/09","CB TOTAL ENERGIES STATION 13/09",-61.30),("16/09","CB PHARMACIE DES LILAS 15/09",-12.50),("18/09","CB CINEMA PATHE 17/09",-21.00),
 ("20/09","VIR SEPA LIVRET A EPARGNE",-100.00),("22/09","CB LECLERC DRIVE 21/09",-88.15),("25/09","CB RESTAURANT LE BISTROT 24/09",-46.00),
 ("27/09","CB IKEA 26/09",-129.00),("28/09","CB MAGASIN XYZ 27/09",-15.00),("29/09","VIR SEPA VERS COMPTE PAUL EXEMPLE",-50.00)]
fr=lambda v:f"{abs(v):,.2f}".replace(',',' ').replace('.',',')
def table(rows,head,css):return f"<table style='width:100%;border-collapse:collapse;font-size:11px'>{''.join(f'<th style=\"text-align:left;border-bottom:1px solid #000;{c}\">{h}</th>' for h,c in zip(head,css))}{''.join('<tr>'+''.join(f'<td style=\"padding:3px 4px;vertical-align:top;{c}\">{x}</td>' for x,c in zip(r,css))+'</tr>' for r in rows)}</table>"
R=lambda c:'text-align:right;'+c
bnp=f"""<h2>BNP PARIBAS (exemple fictif)</h2><p>RELEVÉ DE COMPTE CHÈQUES – Compte joint M. PAUL EXEMPLE ou MME LUCIE EXEMPLE<br>du 1er septembre 2026 au 30 septembre 2026</p>
<p>SOLDE CRÉDITEUR AU 31.08.2026 : 1 250,00</p>{table([(d.replace('/','.'),l,d.replace('/','.'),fr(v) if v<0 else '',fr(v) if v>0 else '') for d,l,v in OPS],['Date','Nature des opérations','Valeur','Débit','Crédit'],['width:50px','','width:50px',R('width:80px'),R('width:80px')])}
<p>TOTAL DES OPÉRATIONS 1 715,13 1 700,00</p><p>SOLDE CRÉDITEUR AU 30.09.2026 1 234,87</p>"""
def cm_label(l):
  if len(l)<28:return l
  k=l.rfind(' ',0,28);return l[:k]+'<br>'+l[k+1:]
cm=f"""<h2>Crédit Mutuel (exemple fictif)</h2><p>Extrait de compte n° 12 – Compte courant joint – du 01/09/2026 au 30/09/2026</p>
{table([(d+'/2026',d+'/2026',cm_label(l),fr(v) if v<0 else '',fr(v) if v>0 else '') for d,l,v in OPS],['Date','Date valeur','Opération','Débit EUROS','Crédit EUROS'],['width:70px','width:70px','',R('width:80px'),R('width:80px')])}<p>Solde au 30/09/2026 : 1 234,87</p>"""
bourso=f"""<h2>Boursorama Banque (exemple fictif)</h2><p>Relevé de compte – période du 01/09/2026 au 30/09/2026</p>
{table([(d+'/2026',l,d+'/2026',fr(v) if v<0 else '',fr(v) if v>0 else '') for d,l,v in OPS],['Date opération','Libellé','Valeur','Débit','Crédit'],['width:75px','','width:75px',R('width:80px'),R('width:80px')])}"""
with sync_playwright() as p:
  b=p.chromium.launch();pg=b.new_page()
  for n,h in [('releve-bnp-fictif.pdf',bnp),('releve-creditmutuel-fictif.pdf',cm),('releve-boursorama-fictif.pdf',bourso)]:
    pg.set_content(f"<html><body style='font-family:Arial;padding:20px'>{h}</body></html>");pg.pdf(path=os.path.join(OUT,n),format='A4')
  b.close()
num=lambda v:f"{v:.2f}".replace('.',',')
open(os.path.join(OUT,'releve-bnp-fictif.csv'),'w',encoding='utf-8').write("Compte de chèques;****9999;Solde au 30/09/2026;1234,87\nDate opération;Libellé court;Type opération;Libellé opération;Montant opération\n"+''.join(f"{d}/2026;{l[:12]};{'CB' if l.startswith('CB') else 'PRLV' if 'PRLV' in l else 'VIR'};{l};{num(v)}\n" for d,l,v in OPS))
open(os.path.join(OUT,'releve-creditmutuel-fictif.csv'),'w',encoding='cp1252').write("Date;Date de valeur;Débit;Crédit;Libellé;Solde\n"+''.join(f"{d}/2026;{d}/2026;{num(v) if v<0 else ''};{num(v) if v>0 else ''};{l};\n" for d,l,v in OPS))
open(os.path.join(OUT,'releve-boursorama-fictif.csv'),'w',encoding='utf-8').write("dateOp;dateVal;label;category;categoryParent;supplierFound;amount;comment;accountNum;accountLabel;accountbalance\n"+''.join(f"2026-09-{d[:2]};2026-09-{d[:2]};\"{l}\";;;;\"{num(v)}\";;00000000000;\"Compte joint\";1234,87\n" for d,l,v in OPS))
open(os.path.join(OUT,'releve-fictif.ofx'),'w').write("OFXHEADER:100\nDATA:OFXSGML\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>\n"+''.join(f"<STMTTRN><TRNTYPE>{'CREDIT' if v>0 else 'DEBIT'}<DTPOSTED>202609{d[:2]}<TRNAMT>{v:.2f}<FITID>F{i}<NAME>{l[:32]}<MEMO>{l}</STMTTRN>\n" for i,(d,l,v) in enumerate(OPS))+"</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>\n")
open(os.path.join(OUT,'releve-fictif.qif'),'w').write("!Type:Bank\n"+''.join(f"D{d}/2026\nT{v:.2f}\nP{l}\n^\n" for d,l,v in OPS))
print('ok',OUT)
