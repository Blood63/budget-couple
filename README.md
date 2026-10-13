# Budget Couple 💰

Application web installable (PWA) pour suivre à deux l'épargne mensuelle, les objectifs, les dépenses fixes, les dépenses diverses et la projection de vos placements. 100 % statique (HTML/CSS/JS), thème sombre, pensée mobile.

## Fonctionnalités
- **Revenus** : revenus par personne (salaire, prime, autre ; récurrents ou ponctuels pour un mois), avec revenus, charges, épargne, **reste à vivre** et **taux d'épargne** par personne et pour le couple.
- **Budget** : *Charges fixes* (libellé, montant, jour de prélèvement, part payée par chacun via un curseur, ex. 70/30, avec la répartition des Réglages par défaut), totaux par personne et virement de l'un vers l'autre ; *Dépenses diverses* comparées au budget du mois.
- **Épargne** : saisie mensuelle répartie automatiquement entre les objectifs (au prorata du besoin mensuel, plafonnée, excédent en « Non affecté ») ou à la main, avec aperçu et historique.
- **Objectifs** : perso et communs, avec progression, reste, effort mensuel et contribution de chacun.
- **Placements** : projection sur 4 ans à intérêts composés, avec graphique.
- **Réglages** (icône en haut à droite) : prénoms, répartition, synchro Supabase, lien d'invitation + QR code, export/import.

Supabase est la source de vérité ; le navigateur garde une copie (cache/sauvegarde). L'appli demande une connexion internet ; le service worker sert seulement à rendre l'appli installable et charge toujours la dernière version.

### Format des données
Les données sont versionnées (`version` dans le JSON, actuellement **3**). À l'ouverture, les anciennes données (localStorage, Supabase ou fichier importé) sont migrées automatiquement : par exemple, les charges v2 « payée par Emilien / Julie / commun » deviennent 100/0, 0/100 ou la répartition des Réglages. Le schéma Supabase ne change pas (tout est dans `data jsonb`).

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
