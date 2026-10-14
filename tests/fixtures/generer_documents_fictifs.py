from playwright.sync_api import sync_playwright
H1="""<html><body style="font-family:Arial;font-size:13px;padding:30px"><h1>MACIF</h1><h2>Conditions particulières – Assurance Multirisque Habitation</h2>
<p>Contrat n° HAB-2024-778812<br>Assuré : M. Paul Exemple et Mme Lucie Exemple<br>Adresse du bien assuré : 12 rue des Lilas, 63000 Clermont-Ferrand</p>
<p>Date d'effet : 01/03/2024<br>Échéance principale : 1er mars<br>Le contrat est reconduit par tacite reconduction.</p>
<p>Cotisation annuelle TTC : 214,80 €</p><h3>Garanties</h3><ul><li>Incendie et événements assimilés</li><li>Dégâts des eaux</li><li>Vol et vandalisme – plafond : 15 000 €</li><li>Responsabilité civile vie privée</li><li>Bris de glace</li></ul>
<p>Franchise générale : 150 €</p><h3>Exclusions</h3><p>Les dommages causés intentionnellement par l'assuré. L'usure normale.</p><p>Assistance 24h/24 : 05 49 00 00 00</p></body></html>"""
H2="""<html><body style="font-family:Arial;font-size:22px;padding:40px;background:#fff"><h1>AXA</h1><h2>Assurance Automobile</h2><p>Contrat n° 0098765432 H<br>Assuré : Julie Exemple<br>Véhicule : Peugeot 208 immatriculé AB-123-CD</p>
<p>Date d'effet : 15/09/2025<br>Échéance annuelle : 15/09</p><p>Prime mensuelle : 42,50 €</p><p>Franchise : 300 €</p><p>Assistance : 01 55 92 00 00</p></body></html>"""
with sync_playwright() as p:
  b=p.chromium.launch();pg=b.new_page()
  pg.set_content(H1);pg.pdf(path='/tmp/docs-fictifs/habitation-fictive.pdf',format='A4')
  pg.set_viewport_size({'width':900,'height':1100});pg.set_content(H2);pg.screenshot(path='/tmp/docs-fictifs/auto-fictive.png')
  from PIL import Image;im=Image.open('/tmp/docs-fictifs/auto-fictive.png').convert('RGB');im.save('/tmp/docs-fictifs/auto-fictive.jpg',quality=85);im.save('/tmp/docs-fictifs/auto-scan.pdf')
  b.close()
