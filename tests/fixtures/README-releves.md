# Relevés fictifs — cas couverts (v12)

Tous les fichiers de ce dossier sont **100 % fictifs**. Aucun relevé réel, aucun nom réel de client et aucune donnée Supabase réelle n'est utilisé. Les parseurs tournent entièrement dans le navigateur.

## Fixtures d'origine (déjà présentes avant v12)

| Fichier | Format / cas | Attendu principal |
|---|---|---|
| `releve-bnp-fictif.csv` / `.pdf` | CSV et PDF BNP fictifs, colonnes débit/crédit | 17 opérations, total net 32,87 € |
| `releve-creditmutuel-fictif.csv` / `.pdf` | CSV et PDF Crédit Mutuel fictifs | mêmes 17 opérations canoniques |
| `releve-boursorama-fictif.csv` / `.pdf` | CSV et PDF Boursorama fictifs | mêmes 17 opérations canoniques |
| `releve-fictif.ofx` | OFX SGML, NAME/MEMO | rapprochement inter-formats |
| `releve-fictif.qif` | QIF bancaire | rapprochement inter-formats |

Ces fixtures couvrent aussi : charges fixes rapprochées, virements internes, versements d'épargne, revenus, doublons entre formats, catégories apprises et annulation d'import.

## Variantes ajoutées en v12

Régénération : `python3 tests/fixtures/generer_releves_variantes_fictives.py` (le PDF utilise Playwright/Chromium local).

| Fichier | Cas limite couvert | Attendu |
|---|---|---|
| `releve-variante-virgules.csv` | séparateur virgule, guillemets, virgule et retour ligne dans un libellé, guillemets doublés | 3 opérations ; libellés normalisés sans casser les lignes |
| `releve-variante-sans-entete.csv` | aucun en-tête, point-virgule, montants français | 900,00 ; −54,20 ; −129,00 |
| `releve-variante-debit-credit.csv` | CP1252, **date de valeur avant date d'opération**, libellé complet, débit positif / crédit séparés | la date d'opération est retenue ; signes corrects |
| `releve-variante.ofx` | balises sur une ligne ou plusieurs lignes, fuseau `[+2:GMT]`, montant à virgule, entité `&amp;`, NAME inclus dans MEMO | 2 opérations ; libellé dédupliqué et décodé |
| `releve-variante.qif` | année à apostrophe `09/03'26`, milliers `1,234.56` et `2,500.00` | −1 234,56 ; 2 500,00 |
| `releve-variante-preambule.csv` | titre libre contenant des virgules avant un en-tête point-virgule | le séparateur du tableau est retenu |
| `releve-variante-signe.pdf` | PDF à **colonne Montant unique signée**, libellé sur deux lignes, en-tête et total à ignorer | 3 opérations ; suite de libellé rattachée ; signes conservés |

## Règles de lecture renforcées

- CSV : tokenizer respectant les guillemets (y compris retours ligne), séparateur détecté (`;`, tabulation, virgule), en-tête cherché dans les 20 premières lignes, préférence à la date d'opération et au libellé complet, repli statistique sans en-tête.
- OFX : entités XML/HTML décodées, montants français via le parseur commun, NAME/MEMO fusionnés sans doublon.
- QIF : montants avec milliers et décimales via le parseur commun.
- PDF : montant choisi au plus près de la colonne « Montant » quand elle est connue ; en colonnes Débit/Crédit, le signe vient de la colonne ; suites de libellé jusqu'à 8 lignes courtes ; en-têtes/pieds répétés ignorés ; montants entre parenthèses lus comme négatifs.

## Limites connues (revue manuelle toujours proposée)

- Un PDF scanné sans couche texte n'est pas lu (pas d'OCR tiers, par choix de confidentialité).
- Un libellé suivi d'une ligne contenant elle-même une date ou un montant peut être interprété comme une nouvelle opération.
- Les formats propriétaires très différents peuvent nécessiter de choisir le bon séparateur dans un futur export ; l'écran de revue permet de corriger avant import.

Chaque import reste réversible : l'écran de revue précède l'écriture, et « Annuler l'import » retire les opérations créées.
