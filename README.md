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

### Cours automatiques PEA / CTO / assurance vie : pourquoi ce n'est pas implémenté

Évaluation faite le 17/10/2026, code actuel à l'appui : les enveloppes sont suivies par **valorisation globale manuelle** (le détail par ligne ISIN/quantité/cours a été retiré à la demande de l'utilisateur, et ne doit pas revenir en douce).

- **Il faudrait des quantités.** Un cours ne sert à rien sans, pour chaque support, l'ISIN ou le symbole, la quantité et la date du cours. Réintroduire cette saisie contredirait le modèle actuel, simple et voulu.
- **Aucune source gratuite n'est proprement utilisable depuis cette PWA statique.** Yahoo Finance est une API non officielle (contrôles du jour : HTTP 429, pas d'en-tête CORS, conditions d'utilisation non pensées pour un scraping automatisé). Stooq, gratuit mais sans garantie ni SLA, a renvoyé 404 sur son endpoint de cotations lors des contrôles, et sa couverture des fonds/OPCVM d'assurance vie est très partielle ; beaucoup de supports d'AV ne sont de toute façon pas cotés en bourse : la valeur de l'assureur fait foi.
- **Une GitHub Action quotidienne ne résout pas le problème.** Elle ne connaît que ce qui est dans ce dépôt public ; vos positions sont privées (dans votre espace Supabase). Publier vos ISIN/quantités dans le dépôt serait inacceptable, et faire lire/écrire vos données par l'Action exigerait une clé de service secrète et un nouveau périmètre de confiance.
- **Ce qu'il faudrait pour le faire proprement** (chantier séparé, à décider explicitement) : une saisie optionnelle et désactivée par défaut des supports (ISIN/symbole + quantité), une source de cours sous licence ou avec clé servie par une fonction serveur (par ex. Supabase Edge Function avec secret, jamais la clé dans le navigateur), l'affichage systématique de la date et de la source du cours, un repli manuel en cas d'échec ou de cours périmé, et des tests sur fixtures. En attendant, la saisie mensuelle de la valorisation globale reste la méthode fiable.

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

## v10 — Répartition des objectifs communs
- Par objectif commun : répartition de la cible selon les réglages (défaut), en % (curseur + presets 50/50, 60/40, 70/30, 80/20, 40/60, 30/70) ou en montants fixes par personne (la somme doit égaler la cible).
- La répartition automatique de l'épargne finance la **part cible de chaque personne** (besoin = reste de sa part ÷ mois restants) ; l'historique est recalculé à chaque changement. Les répartitions manuelles d'un mois sont conservées (au-delà de sa part, elles complètent la part de l'autre).
- Affichage par personne : part cible, déjà versé (dont part de l'initial), reste, €/mois nécessaire.
- Migration v11 additive (`split: null` = réglages). Tests : `tests/e2e/test_objectif_repartition.py`, check-up global `tests/e2e/test_checkup.py` (données vides, anciennes, volumineuses ; 320/390/768 px ; réseau externe bloqué).

## v12 — Épargne par personne, graphiques interactifs, projection 5 ans et dépenses lisibles

- **Placements par personne** : en tête de l'onglet Placements, une carte par personne affiche le total des placements personnels (dernières valorisations des enveloppes + soldes des livrets), la part dans l'ensemble, le total indicatif après répartition des placements communs selon les réglages (règle affichée, propriété inchangée), le total versé connu, les intérêts/plus-values connus et les versements mensuels ; le total des placements communs reste affiché séparément. Dans Épargne par personne, le total placements de la personne sélectionnée est présenté en bandeau bien visible et cliquable vers l'onglet Placements.
- **Épargne par personne** : dans l'onglet Épargne, deux cartes comparatives (total cumulé, 12 derniers mois, moyenne, objectifs financés, placements directs), puis le détail de la personne choisie — par mois (graphique mensuel + cumul), par objectif (cible, déjà financé, reste, besoin mensuel) et par placement. Les placements communs sont répartis à titre indicatif selon les réglages, sans changer leur propriété ; épargne mensuelle, objectifs et placements sont trois vues du même argent et ne sont pas additionnés.
- **Graphiques interactifs partout** (épargne, intérêts, valorisations, projection placements 4 ans, nouvelle projection 5 ans, catégories) : survol/clic sur desktop, appui et glissement du doigt sur mobile, crosshair, valeur exacte et détail sous le graphique, vibration douce si disponible, curseur tactile de 44 px utilisable au clavier (flèches, Début/Fin) et tableau complet des données pour les lecteurs d'écran. Le donut des catégories se pilote aussi au clavier et affiche le détail de la part touchée.
- **Projection d'épargne totale à 5 ans** : en plus de la projection placements à 4 ans, projection de l'épargne totale intégrant l'épargne mensuelle historique, les versements permanents des placements (jamais comptés deux fois), les intérêts des livrets et la valorisation des enveloppes à leur rendement estimé. Deux scénarios basés sur l'historique : prudent = 90 % de la plus faible moyenne (3, 6 ou 12 mois), réaliste = moyenne des moyennes 6 et 12 mois. Hypothèses, moyennes utilisées et avertissement (hors inflation/impôts/frais, pas un conseil) affichés dans la carte ; valeurs année par année et graphique interactif.
- **Dépenses plus simples** : résumé du mois (total, budget restant, nombre d'opérations, moyenne, rythme par jour et projection de fin de mois avec alerte de dépassement), catégories en chips et barres cliquables, recherche, filtres catégorie/payeur/origine, tris, regroupement par jour avec total, suppression en un geste (44 px, annulable), duplication d'une dépense et export CSV de la sélection filtrée.
- **Relevés renforcés** : CSV à guillemets multilignes, sans en-tête, débit/crédit avec date de valeur, OFX à entités et montants français, QIF à milliers, PDF à colonne signée et libellés multilignes. Cas couverts et limites : `tests/fixtures/README-releves.md` (fixtures uniquement fictives).
- **Autres ajouts** : contrôle de cohérence des données en lecture seule dans Réglages (valorisation absente, objectif sans date, mois en double, charge sans jour…) avec accès direct à l'écran concerné ; le formulaire rapide « Dettes entre nous » conserve désormais la saisie en cours si une synchronisation rafraîchit l'écran.
- **Safe to spend** : sur l'Accueil, « Reste à dépenser par jour » = budget de dépenses diverses restant / jours restants (aujourd'hui inclus), avec alerte si le budget est déjà dépassé et projection de fin de mois au rythme actuel — même calcul que l'écran Dépenses.
- **Settle Up (dettes)** : pour un couple, le solde net unique existait déjà ; la carte « Dettes entre nous » l'explicite maintenant en « Virement unique pour tout solder » avec bouton « Marquer comme réglé » (ou « aucun virement nécessaire » si les dettes se compensent), dettes seules — l'équilibre du mois garde son propre règlement, sans double comptage.
- **Correctifs issus d’une revue externe vérifiée dans le code** : dates « aujourd’hui / mois courant » et dates par défaut des saisies en heure locale (plus de décalage UTC entre 0 h et 2 h) ; versements programmés des placements intégrés à la prévision de compte des mois sans épargne saisie (sans double comptage si le mois est saisi) ; projections 4 ans et 5 ans plafonnées (plafonds de versement, PEL ouvert depuis mars 2011 sans versement après 10 ans, excédent redirigé vers une poche libre à 0 %) ; alerte PEA 150 000 € sur les versements (pas sur la valorisation) et alertes livrets reformulées (le plafond juge les versements, les intérêts peuvent le dépasser) ; conseil LEP seulement si le RFR estimé du foyer est proche ou sous le plafond ; conseil PER précisé (estimation sur les revenus actuels, plafond réel sur l’avis d’impôt d’après les revenus de l’année précédente, reliquats et mutualisation possible en imposition commune à vérifier) ; recherche sans recréation du DOM à chaque frappe (debounce 120 ms, focus restauré) ; lien d’invitation affiché masqué (copie, partage et QR inchangés).
- Aucune migration : version de données inchangée (12), aucun champ persistant ajouté. Service worker v23.

## v11 — Dettes entre nous, espace utilisé
- Carte **Dettes entre nous** sur l'Accueil : petites sommes avancées (qui doit à qui, montant, libellé, date), ajout rapide, modification / suppression avec « Annuler », remboursement d'une ligne ou de tout (archivées, consultables, réouvrables), total dû par chacun et solde net.
- Présentation cohérente avec l'**Équilibre du mois** : les dettes sont suivies à part (jamais ajoutées aux charges/dépenses du mois), la carte Équilibre affiche une note « Hors dettes entre nous… Total tout compris : … ». Pas de double comptage.
- Synchronisation par élément (liste `debts`, fusion et suppressions comme le reste). Migration de données v12 purement additive (`debts: []`).
- **Espace utilisé** (Réglages) : taille du document partagé vs 500 Mo de base Supabase, documents vs 1 Go de Storage, stockage local vs ≈ 5 M caractères. Si localStorage est plein, la sauvegarde bascule sur IndexedDB (aucune perte) et revient automatiquement.
- Mise en page : libellés longs et montants à 7 chiffres sans troncature ni chevauchement de 320 à 430 px (check-up automatisé `tests/e2e/test_checkup.py`).

## v13 — Sécurité renforcée, invitation par code, plafonds, thème clair

### Sécurité Supabase (`supabase/secure.sql`)
Avant : toute personne possédant la clé publishable (publique) pouvait **lister tous les espaces et tous les documents**.
Après : accès uniquement via les fonctions `get_space` / `save_space` / `sync_ts` avec le code exact ; plus de listing de la table ni du Storage.

Étapes :
1. Supabase › SQL Editor : exécuter `supabase/secure.sql` (après `schema.sql` et `storage.sql`). Le script est idempotent et ne modifie aucune donnée.
2. Exécuter les requêtes de vérification (bloc 4, en lecture seule) : `anon_peut_lire_table` doit valoir `false`.
3. Dans l'appli › Réglages : « Sécurité renforcée : Oui ».
4. « Changer le code d'espace » : un code aléatoire fort est généré, puis données et documents sont copiés (rien n'est effacé).
5. Envoyer le **code seul** à votre partenaire (Inviter › Code seul) : il le saisit ou scanne le QR.
6. Quand tout est synchronisé : « Vider l'ancien espace ».

⚠️ Ne pas ré-exécuter `schema.sql` après `secure.sql` (cela recréerait les anciennes policies ouvertes) ; si besoin, relancez `secure.sql` ensuite.

### Autres nouveautés
- Invitation : lien complet (appareil neuf) ou code seul (appareil déjà configuré).
- Accueil allégé : reste à vivre, reste à dépenser par jour, au plus 3 alertes ; le reste dans « Plus ».
- Plafonds optionnels par catégorie (Dépenses), avec alerte et reste par catégorie.
- Thème clair / sombre (automatique ou manuel, Réglages › Affichage).
- Données vierges sans informations personnelles ; la fusion ne remplace jamais une valeur réelle par une valeur par défaut.
