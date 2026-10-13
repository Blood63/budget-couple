# Budget Couple 💰

Application web installable (PWA) pour suivre à deux l'épargne mensuelle, les objectifs, les dépenses fixes, les dépenses diverses et la projection de vos placements. 100 % statique (HTML/CSS/JS), thème sombre, pensée mobile.

## Fonctionnalités
- **Épargne** : montant mis de côté par chacun, chaque mois ; total du mois, cumul par personne et global.
- **Objectifs** : individuels ou communs (Japon, apport appart, voiture…) avec cible, économisé, reste, barre de progression et montant à mettre de côté par mois jusqu'à la date cible.
- **Dépenses fixes** : libellé, montant, jour de prélèvement, payeur (couleur par personne / commun), total, part de chacun (répartition du commun réglable) et virement mensuel de l'un vers l'autre (ex. loyer).
- **Diverses** : budget disponible par mois vs dépenses réalisées.
- **Placements** : capital, versement mensuel permanent et taux annuel ; projection sur **4 ans (48 mois)** à intérêts composés mensuels, affichée par fin d'année 1 à 4 avec graphique.
- **Réglages** : prénoms, répartition, synchro Supabase, export/import JSON.

Les données sont stockées dans le navigateur (localStorage). La synchro Supabase est optionnelle.

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
