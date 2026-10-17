"""Variantes FICTIVES de relevés : cas limites de formats bancaires. Aucune donnée réelle."""
import os
from playwright.sync_api import sync_playwright
OUT=os.path.dirname(os.path.abspath(__file__))
open(os.path.join(OUT,'releve-variante-virgules.csv'),'w',encoding='utf-8',newline='').write(
'Date,Description,Montant\n'
'2026-09-01,"Virement recu, Paul Exemple",900.00\n'
'2026-09-03,"CB CARREFOUR MARKET\nPARIS 15",-54.20\n'
'2026-09-04,"Paiement ""special"" IKEA",-129.00\n')
open(os.path.join(OUT,'releve-variante-preambule.csv'),'w',encoding='utf-8').write('Relevé fictif, septembre 2026 - Banque Exemple\nDate;Libellé;Montant\n01/09/2026;VIR PAUL EXEMPLE;900,00\n03/09/2026;CB CARREFOUR;-54,20\n')
open(os.path.join(OUT,'releve-variante-sans-entete.csv'),'w',encoding='utf-8').write(
'01/09/2026;VIR PAUL EXEMPLE;900,00\n03/09/2026;CB CARREFOUR MARKET;-54,20\n04/09/2026;CB IKEA;-129,00\n')
open(os.path.join(OUT,'releve-variante-debit-credit.csv'),'w',encoding='cp1252').write(
'Date de valeur;Date opération;Libellé;Débit;Crédit\n02/09/2026;01/09/2026;VIR PAUL EXEMPLE;;900,00\n04/09/2026;03/09/2026;CB CARREFOUR MARKET;54,20;\n05/09/2026;04/09/2026;CB IKEA;129,00;\n')
open(os.path.join(OUT,'releve-variante.ofx'),'w').write("""OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260901000000[+2:GMT]
<TRNAMT>900,00
<NAME>VIR PAUL &amp; CIE
<MEMO>VIR PAUL &amp; CIE EXEMPLE
</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260903<TRNAMT>-54,20<NAME>CB CARREFOUR<MEMO>CB CARREFOUR MARKET</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>
""")
open(os.path.join(OUT,'releve-variante.qif'),'w').write("!Type:Bank\nD09/03'26\nT-1,234.56\nPCB CARREFOUR MARKET\n^\nD09/04'26\nT2,500.00\nPVIR PAUL EXEMPLE\n^\n")
rows=[('01/09/2026','VIR PAUL EXEMPLE','+900,00'),('03/09/2026','CB CARREFOUR MARKET PARIS 15','-54,20'),('','ACHAT DU 02/09 CARTE 1234',''),('04/09/2026','CB IKEA','-129,00')]
html="<h2>Banque fictive — relevé signé</h2><p>du 01/09/2026 au 30/09/2026</p><table style='width:100%;border-collapse:collapse;font-size:11px'><tr><th>Date</th><th>Libellé</th><th>Montant</th></tr>"+''.join(f"<tr><td>{d}</td><td>{l}</td><td style='text-align:right'>{a}</td></tr>" for d,l,a in rows)+"</table><p>Total des opérations -183,20</p>"
with sync_playwright() as p:
 b=p.chromium.launch();pg=b.new_page();pg.set_content(f"<html><body style='font-family:Arial;padding:20px'>{html}</body></html>");pg.pdf(path=os.path.join(OUT,'releve-variante-signe.pdf'),format='A4');b.close()
print('variantes fictives générées')
