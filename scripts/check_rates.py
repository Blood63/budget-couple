#!/usr/bin/env python3
"""Vérifie les taux réglementés publiés sur service-public.gouv.fr / banque-france.fr
et les compare au taux en vigueur dans rates.json.
Sortie : écrit un rapport Markdown dans $GITHUB_STEP_SUMMARY (si défini) et dans rates-report.md.
Code de retour : 0 = identique, 10 = différence détectée, 20 = page illisible."""
import html, json, re, sys, os, datetime, urllib.request

SOURCES = {
    "livretA": ("https://www.service-public.gouv.fr/particuliers/vosdroits/F2365", r"taux d.int[ée]r[êe]t annuel du livret A est de (\d+(?:[.,]\d+)?)\s?%"),
    "ldds":    ("https://www.service-public.gouv.fr/particuliers/vosdroits/F2368", r"Le taux d.int[ée]r[êe]t annuel est de (\d+(?:[.,]\d+)?)\s?%"),
    "lep":     ("https://www.service-public.gouv.fr/particuliers/vosdroits/F2367", r"Le taux d.int[ée]r[êe]t du LEP est de (\d+(?:[.,]\d+)?)\s?%"),
    "cel":     ("https://www.banque-france.fr/fr/a-votre-service/particuliers/connaitre-pratiques-bancaires-assurance/epargne/epargne-logement", r"taux de r[ée]mun[ée]ration du CEL est de (\d+(?:[.,]\d+)?)\s?%"),
}

def page_text(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (budget-couple rates check)"})
    raw = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", raw)))

def parse(key, text):
    m = re.search(SOURCES[key][1], text, re.I)
    return float(m.group(1).replace(",", ".")) if m else None

def current(rates, key, today):
    return next((h for h in rates["products"][key]["history"] if h["from"] <= today), None)

def main(path="rates.json", fetch=page_text):
    rates = json.load(open(path, encoding="utf-8"))
    today = datetime.date.today().isoformat()
    lines, changed, unreadable = [], [], []
    for key, (url, _) in SOURCES.items():
        name = rates["products"][key]["name"]
        cur = current(rates, key, today)
        try:
            found = parse(key, fetch(url))
        except Exception as e:  # réseau, 403…
            found, err = None, str(e)
        if found is None:
            unreadable.append(key); lines.append(f"| {name} | {cur['rate'] if cur else '?'} % | illisible | [source]({url}) |")
        elif not cur or abs(found - cur["rate"]) > 1e-9:
            changed.append((key, found)); lines.append(f"| {name} | {cur['rate'] if cur else '?'} % | **{found} %** | [source]({url}) |")
        else:
            lines.append(f"| {name} | {cur['rate']} % | {found} % ✓ | [source]({url}) |")
    report = "## Vérification des taux réglementés (" + today + ")\n\n| Produit | rates.json | Source officielle | Lien |\n|---|---|---|---|\n" + "\n".join(lines) + "\n"
    if changed:
        report += "\n### Action requise\nAjoutez en tête de `history` dans `rates.json` une entrée `{\"from\": \"AAAA-MM-JJ\", \"rate\": X}` avec la date d'effet officielle (arrêté au Journal officiel), puis mettez à jour `checked`.\n"
    if unreadable:
        report += "\nCertaines pages n'ont pas pu être lues (structure modifiée ou accès refusé) : vérifiez manuellement.\n"
    open("rates-report.md", "w", encoding="utf-8").write(report)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8").write(report)
    print(report)
    return 10 if changed else 20 if unreadable else 0

if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:2]))
