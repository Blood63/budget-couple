# Budget Couple 💰

Application web installable (PWA) pour suivre à deux l'épargne mensuelle, les objectifs, les dépenses fixes, les dépenses diverses et la projection de vos placements. 100 % statique (HTML/CSS/JS), thème sombre, pensée mobile.

## Fonctionnalités
- **Accueil** : résumé du mois (reste à vivre, revenus, épargne, dépenses vs budget), saisie rapide d'une dépense, **équilibre « qui doit combien à qui »** (avec « Marquer comme réglé »), prochains prélèvements, progression des objectifs, activité récente.
- **Budget** : *Revenus* (salaire, prime, autre ; récurrent ou ponctuel) avec reste à vivre et taux d'épargne par personne ; *Charges* (catégorie, jour, compte de prélèvement, part de chacun via curseur, graphique par catégorie, recherche/filtre) ; *Dépenses* (saisie rapide : montant, catégorie, payé par, pour qui ; budget du mois, graphique par catégorie, recherche et filtres).
- **Épargne** : saisie mensuelle répartie automatiquement entre les objectifs (ou manuellement), graphique d'évolution, historique des affectations.
- **Objectifs** : perso et communs, progression, effort mensuel, contribution de chacun, filtre.
- **Placements** : banque (avec suggestions, regroupement et filtre), types Livret A / LDDS / LEP / CEL (**taux réglementé mis à jour automatiquement**, bascule possible en taux manuel), PEL (taux officiel proposé selon la date d'ouverture puis **figé**), Livret Jeune (taux de la banque, rappel du minimum = Livret A), Assurance vie / PEA / Compte-titres / PER avec **lignes** (ISIN vérifié, fonds euros, UC/ETF, actions, OPCVM, quantité, PRU, cours, date de valorisation, versements programmés, plus-values, graphique de répartition), projection 4 ans.
- **Historique** : chaque modification est signée par la personne qui utilise l'appareil (choisie au premier lancement, modifiable dans Réglages), avec recherche et filtre.
- **Réglages** (icône en haut à droite) : prénoms, répartition, personne de l'appareil, synchro Supabase, lien d'invitation + QR code, export/import.
- Accessibilité : navigation au clavier (flèches dans la barre d'onglets, piégeage du focus dans les feuilles), rôles ARIA, barres de progression annoncées, contraste renforcé si demandé, animations réduites si demandé. Vérifié avec axe-core (WCAG 2 A/AA).

## Synchronisation sans perte
Supabase est la source de vérité (le navigateur garde une copie). Chaque élément porte un identifiant et une date de modification (par champ) ; les suppressions sont conservées sous forme de « pierres tombales ». À chaque synchro, l'appli lit les données, **fusionne élément par élément et champ par champ** (la modification la plus récente gagne, les ajouts des deux côtés sont conservés), puis écrit seulement si personne n'a écrit entre-temps (sinon elle recommence). Deux téléphones peuvent donc modifier en même temps sans rien perdre. L'appli se resynchronise à l'ouverture, au retour au premier plan et toutes les 15 secondes.

## Taux réglementés
Les taux sont dans `rates.json` (date d'effet, historique, sources officielles service-public.gouv.fr / banque-france.fr), chargé au démarrage. Le workflow `.github/workflows/taux.yml` vérifie chaque mois les pages officielles (`scripts/check_rates.py`) et **ouvre une issue** si un taux a changé ou si une page n'est plus lisible. Mise à jour : ajouter en tête de `history` une entrée `{"from": "AAAA-MM-JJ", "rate": X}` puis modifier `checked`. Les taux changent normalement au 1er février et au 1er août.

Les cours des titres sont saisis à la main (pas de source de cours gratuite, fiable et sans clé utilisable depuis le navigateur).

### Format des données
Les données sont versionnées (actuellement **v5**) et migrées automatiquement à l'ouverture (localStorage, Supabase, fichier importé) : v2→v3 charges en %, v3→v4 horodatage par élément, catégories, payeur réel, historique, v4→v5 placements typés et lignes d'enveloppe. Le schéma Supabase ne change pas (tout est dans `data jsonb`).

## Tests
```bash
node tests/test_store.js                 # migrations, fusion, ISIN
python3 tests/test_check_rates.py        # script de vérification des taux
python3 tests/e2e/test_sync_deux_appareils.py   # Playwright : 2 appareils simulés en parallèle
python3 tests/e2e/test_tableau_de_bord.py
python3 tests/e2e/test_placements.py
```

## Tester en local
```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Déployer sur GitHub Pages
1. Créez un dépôt (ex. `budget-couple`) et poussez ces fichiers à la racine :
   ```bash
   git init && git add . && git commit -m "Budget Couple"
   gh repo create budget-couple --public --source=. --push   # ou --private (Pages privé = offre payante)
   ```
2. Sur GitHub : **Settings → Pages → Build and deployment → Deploy from a branch**, branche `main`, dossier `/ (root)`.
3. Après une minute, l'appli est sur `https://<votre-pseudo>.github.io/budget-couple/`.
4. **Installer** : sur iPhone, Safari → Partager → « Sur l'écran d'accueil » ; sur Android/Chrome, menu → « Installer l'application » ; sur ordinateur, icône d'installation dans la barre d'adresse.

## Synchroniser vos deux téléphones (Supabase, gratuit)
1. Créez un projet sur <https://supabase.com>.
2. **SQL Editor** → collez et exécutez `supabase/schema.sql`.
3. **Project Settings → API** : copiez l'**URL du projet** et la clé **publishable** (`sb_publishable_…`) ou l'ancienne clé **anon**. En cas de problème, Réglages affiche le message d'erreur précis (table absente, clé refusée, URL injoignable).
4. Dans l'appli → **Réglages** : collez URL + clé, puis choisissez un **code d'espace** long et secret (8 caractères min.). Faites la même chose sur l'autre téléphone avec **le même code**.
5. La synchro se fait à chaque modification et à l'ouverture (la version la plus récente gagne).

⚠️ Sécurité : la sécurité repose sur le secret du code d'espace (politiques RLS simples, sans compte). Avec la clé anon, une personne technique pourrait lister les espaces de votre projet : n'utilisez ce projet Supabase que pour cette appli et ne publiez pas la clé ailleurs que dans l'appli. Pour aller plus loin, activez Supabase Auth et limitez les politiques à `auth.uid()`.

## Structure
```
index.html  style.css  app.js  manifest.json  sw.js  icons/  supabase/schema.sql  screenshots/
```
