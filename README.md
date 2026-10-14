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
Les données sont versionnées (actuellement **v9**) et migrées automatiquement à l'ouverture (localStorage, Supabase, fichier importé) : v2→v3 charges en %, v3→v4 horodatage par élément, catégories, payeur réel, historique, v4→v5 placements typés et lignes d'enveloppe, v5→v6 valorisations globales, v6→v7 âges/impôt/conseils, v7→v8 comptes courants (identifiants déterministes `acc-joint`, `acc-p1`, `acc-p2` : deux téléphones qui migrent séparément obtiennent exactement les mêmes données), assurances, intérêts, mouvements, bilans, v8→v9 relevés importés et catégories apprises (aucune donnée existante modifiée). Le schéma Supabase ne change pas (tout est dans `data jsonb`).

## Tests
```bash
node tests/test_store.js                 # migrations (toutes versions → v8), fusion, ISIN, impôt
node tests/test_finance.js               # comptes, intérêts par quinzaines, extraction assurance
python3 tests/test_check_rates.py        # script de vérification des taux
python3 tests/e2e/test_sync_deux_appareils.py   # Playwright : 2 appareils simulés en parallèle
python3 tests/e2e/test_tableau_de_bord.py
python3 tests/e2e/test_placements.py
python3 tests/e2e/test_conseils.py
python3 tests/e2e/test_assurances.py     # pdf.js + OCR local, Storage simulé, repli local, 2 appareils, axe
python3 tests/e2e/test_releves.py        # relevés fictifs BNP / Crédit Mutuel / Boursorama (PDF, CSV), OFX, QIF
python3 tests/e2e/test_interets_bilans.py # horloge au 3/01 : intérêts à valider, bilan du mois, comptes 360/390/430 px
```
Les documents de test (`tests/fixtures/`) sont fictifs et générés par `tests/fixtures/generer_documents_fictifs.py`.

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
index.html  style.css  store.js  finance.js  accounts.js  insurance.js  interests.js  reports.js  statements.js  app.js
manifest-v2.webmanifest  sw.js  icons/  vendor/ (qrcode, pdf.js, tesseract.js + français)  supabase/schema.sql  supabase/storage.sql  screenshots/
```

## v4 — Enveloppes à valorisation globale (format de données v6)

- **AV / PEA / CTO / PER** : plus de lignes (ISIN, quantités, cours). Chaque enveloppe a une **valorisation globale saisie à la main**, un **historique daté** avec graphique d'évolution, le **total versé** et la **plus-value globale** (valorisation − versements), un **versement mensuel programmé** et un **rendement estimé** pour la projection à 4 ans.
- **Migration v5 → v6** (automatique, testée, idempotente) : valorisation = somme des lignes, versé = somme des coûts, versement mensuel = somme des versements des lignes, rendement = moyenne pondérée par la valeur. Les anciennes lignes sont **conservées en archive** (visibles dans la fiche de l'enveloppe, section « Ancien détail archivé »).
- **Rappel mensuel** : le jour est réglable dans Réglages (1er par défaut). Toute enveloppe dont la dernière valorisation est antérieure au dernier jour de rappel apparaît sur l'Accueil dans la carte « Mettre à jour la valorisation » (saisie rapide) et un badge s'affiche sur l'onglet Placements.
- Revue UX : guide « Pour bien démarrer », confirmations de suppression nommées, messages après enregistrement, bouton retour Android qui ferme la fenêtre, validation de tous les montants, Entrée pour valider le budget, objectifs « atteint » / « échéance dépassée », badge de synchro cliquable.
- Tests : `python3 -u tests/e2e/test_placements.py` (migration, valorisations, rappel, validations, projection, accessibilité axe).

## v5 — Conseils, âge et estimation de l'impôt (format de données v7)

- **Conseils** (carte sur l'Accueil + liste complète dans Placements) : conseils **pédagogiques génériques** calculés sur vos données, chacun avec une explication courte, un « Pourquoi » chiffré et un bouton pour le masquer (masquage synchronisé, « Réafficher » possible). **Jamais** de recommandation de fonds, d'action, d'ETF ou d'allocation : renvoi systématique vers la banque ou un conseiller. Disclaimer visible.
  Règles : épargne de précaution (3-6 mois de dépenses), plafonds réglementaires atteints ou proches, argent non affecté sur le compte courant, LEP sous conditions de revenus, ordre de remplissage des livrets par taux, PEL > 10 / 15 ans, taux d'épargne < 10 %, objectif en retard, reste à vivre négatif, dépenses diverses et charges fixes en hausse, Livret Jeune (12-25 ans, clôture le 31/12 de l'année des 25 ans), prendre date PEA (5 ans) / assurance vie (8 ans), horizon long terme, PER (économie ≈ versement × TMI, plafond ≈ 10 % des revenus pro, blocage jusqu'à la retraite, surtout pertinent à TMI ≥ 30 %).
- **Dates de naissance** dans Réglages (âge calculé).
- **Impôt sur le revenu (estimation approximative)** dans Budget › Revenus : situation (célibataires / pacsés-mariés), enfants, abattement 10 % (min 509 €, max 14 555 €), barème 2026 sur revenus 2025, quotient familial plafonné, décote, TMI, taux moyen, comparaison imposition séparée vs commune. Sans prélèvements sociaux ni cas particuliers.
- `rates.json` contient désormais les plafonds (`ceilings`), le plafond de revenus LEP, le barème (`incomeTax`), le plafond PER et les règles d'âge, chacun avec sa source officielle (service-public.gouv.fr, BOFiP), vérifiés le 13/10/2026.
- Migration v6 → v7 : liste `dismissed`, `births`, `tax` (testée dans `tests/test_store.js`). Tests navigateur : `python3 -u tests/e2e/test_conseils.py`.

## v7 — Comptes, assurances, intérêts, bilans (format de données v8)
- **Comptes courants** (Budget › Comptes) : banque, titulaire (Emilien, Julie ou joint), libellé, solde à une date. Chaque charge a un compte débité et chaque revenu un compte crédité (jour de réception). Pour chaque compte : entrées, sorties, solde prévu en fin de mois, prochains prélèvements et alerte de découvert. Un compte joint peut être alimenté chaque mois par chacun.
- **Assurances** (Accueil › Assurances) : fiche par contrat et document (PDF ou photo). Le texte est lu **sur le téléphone** (pdf.js et, en option, l'OCR tesseract.js en français, tous deux dans `vendor/`) : aucun envoi à un service tiers. Des règles repèrent l'assureur, le n° de contrat, l'assuré, le bien/véhicule, la cotisation (mois/an), les dates, les franchises, les garanties, les plafonds, les exclusions et le téléphone d'assistance ; tout reste modifiable. Une fiche peut être liée à une charge (ou en créer une). Rappel 45 jours avant l'échéance, avec la règle de résiliation (loi Hamon après 1 an pour habitation/auto/moto/affinitaire, complémentaire santé après 1 an, loi Lemoine pour l'emprunteur, sinon à l'échéance – loi Chatel).
  - Documents : bucket **privé** Supabase Storage `documents`, à créer **une fois** avec `supabase/storage.sql` (SQL Editor). Sans bucket, sans synchro ou en cas d'erreur, le document reste sur l'appareil (IndexedDB) et peut être envoyé plus tard (« Envoyer vers Supabase »). Le dossier est l'empreinte SHA-256 du code d'espace (le code n'apparaît pas dans le stockage). Limite : même modèle de sécurité que la table (clé publishable + code d'espace).
- **Assurance vie** : part fonds euros (en % ou en €) / unités de compte. En janvier, l'appli demande le rendement net du fonds euros de l'année passée et calcule les intérêts crédités.
- **Livrets** : intérêts calculés par **quinzaines** (versement rémunéré à partir du 1er ou 16 suivant, retrait non rémunéré dès le 1er ou 16 précédent ; taux successifs de `rates.json`), avec les versements programmés (jour du versement), les mouvements exceptionnels et le solde au 1er janvier (estimé ou saisi). Proposés du 31/12 à fin février, montant réel corrigeable, ajouté au solde.
- **Récap des intérêts** (Accueil › Intérêts) : par année et par placement, estimation de l'année en cours et potentiel des 4 années suivantes.
- **Bilan du mois** : généré automatiquement le 1er pour le mois écoulé (épargne, écart avec le mois précédent, objectifs, intérêts, charges et dépenses), carte sur l'accueil du 1er au 7, historique (Accueil › Bilans). Notification locale optionnelle (Réglages) affichée à la première ouverture du mois : une vraie notification push application fermée demanderait un serveur d'envoi (clés VAPID + tâche planifiée), non utilisé ici.
- Export CSV (Réglages › Sauvegarde).

## v8 — Import de relevés de compte (format de données v9)
- Budget › Dépenses ou Budget › Comptes › **Importer un relevé** : PDF (pdf.js, colonnes Débit/Crédit repérées), CSV (en-têtes BNP, Crédit Mutuel, Boursorama et génériques, `;` `,` ou tabulation, UTF-8 ou Windows-1252), OFX/QFX, QIF. Tout est lu dans le navigateur ; le fichier n'est ni envoyé ni conservé.
- Rapprochement automatique par opération : **charge fixe** (montant ± 5 % / 2 €, libellé proche ou jour à ± 3 jours, même compte), **virement interne** (vers/depuis un autre compte du couple, prénoms, montant du virement ou de l'alimentation du compte joint), **versement épargne** (livret, LDDS, PEL, assurance vie, versement programmé), **revenu** ; ces lignes ne deviennent pas des dépenses (pas de double comptage). Le reste devient **dépense diverse** avec catégorie automatique (mots-clés) ; une catégorie corrigée est **apprise** pour ce marchand (synchronisée).
- Écran de revue : type, catégorie, payeur, charge associée, suppression de ligne (annulable). Doublons : une opération déjà importée (même date, montant, libellé, quel que soit le format) est exclue ; une dépense saisie à la main au même montant à ± 3 jours est signalée.
- Après import : récap des dépenses diverses du mois par catégorie ; un import peut être annulé (et rétabli).
- Toute dépense se modifie en la touchant et se supprime d'un geste, avec « Annuler » pendant 6 s.
- Le récap des intérêts est maintenant dans l'onglet **Épargne** (section Intérêts) ; le raccourci « Intérêts » de l'accueil y mène.

## v9 — Indicateur de qualité (indicatif, pas un conseil)
- **Assurances** (habitation, auto, moto, santé, prévoyance, trottinette) : note /100 et lettre A-E, détail par critère (cotisation vs repère du profil ou de l'âge, franchise, garanties clés, plafonds) et garanties importantes manquantes. Nouveaux champs : profil (locataire / propriétaire / PNO, formule auto), personnes couvertes et assuré principal (santé).
- **AV, PER, PEA, CTO** : fiche contrat (frais d'entrée, gestion UC et fonds euros, arbitrage, rendement N-1, supports et ETF, gestion pilotée, versement minimum ; courtage, droits de garde, tenue de compte pour PEA/CTO). Préremplissage depuis une liste de contrats connus (frais publics, source et date), uniquement pour décrire **son propre** contrat : aucun produit n'est recommandé.
- Coût estimé des frais sur 10 ans comparé à trois repères (moyenne du marché, contrats en ligne, contrats bancaires), même rendement brut pour tous.
- Repères dans `market.json` (sources et dates : France Assureurs, UFC-Que Choisir, comparateurs publics, AMF, ACPR…). Les seuils de franchise sont des repères internes, signalés comme tels.
- Migration de données v10 (champ `contract` sur les enveloppes, profil / personnes sur les assurances), tests `tests/test_quality.js` et `tests/e2e/test_qualite.py`.
