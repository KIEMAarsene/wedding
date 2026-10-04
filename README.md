# Arsène & Geneviève — Invitations et accueil

Application française pour le mariage du **17 octobre 2026 à Ouagadougou**, réception **Espace Dieudonné – Salle Princesse**, capacité indicative **300 personnes**.

Next.js 16, React, TypeScript, Tailwind 4, Supabase Auth/PostgreSQL, QRCode et ZXing. Compatible Vercel. Le projet contient les écrans, les API, les migrations SQL/RLS, une démonstration persistante sur disque, import/export CSV et tests. Aucune inscription invité.

## Démarrer immédiatement

Prérequis : Node.js 22 ou 24, pnpm. Depuis ce dossier :

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Sous PowerShell, utiliser `Copy-Item .env.example .env.local`. Définir `DEMO_MODE=true`, `DEMO_PASSWORD=votre-mot-de-passe-local` et `APP_URL=http://127.0.0.1:3000` dans `.env.local`, puis :

```sh
pnpm dev
```

Ouvrir [la démonstration locale](http://127.0.0.1:3000). Une configuration locale est déjà créée dans ce workspace. Connexion : n’importe quelle adresse e-mail valide, mot de passe **votre-mot-de-passe-local**, rôle choisi dans le formulaire (démo seulement). Les données sont fictives. La première famille a un lien démo visible sur l’accueil. La démo est **désactivée en production**, même si DEMO_MODE reste à true. Elle ne remplace pas Supabase et ne garantit pas une admission multi-instance.

Le fichier `.demo/data.json` contient les données locales et n’est pas versionné. Pour recommencer une démonstration, arrêter le serveur et renommer ce fichier en sauvegarde. Ne jamais transférer ce fichier vers une application publique.

## Parcours

- `/` : présentation du mariage, accès équipe et lien de démonstration locale.
- `/i/<token>` : invitation personnelle, quota, réponse modifiable, laissez-passer QR, téléchargement PNG du QR ou impression du pass complet.
- `/login` : authentification Supabase par e-mail/mot de passe.
- `/admin` : statistiques invitations/personnes, ventilation par catégorie, création, édition, filtres, envoi WhatsApp préparé, marquage envoyé, import/export, annulation/réactivation, corrections avec motif, rotation des liens, journal.
- `/accueil` : caméra arrière, saisie du token QR ou recherche manuelle, vérification, entrée partielle, état complet/annulé/non confirmé. Le scan ne consomme aucune place avant validation.

Le programme fourni est affiché sur l’invitation personnelle : **11h00 Église Saint Camille**, **13h30 Mairie de Bogodogo**, **14h30 Espace Dieudonné – Salle Princesse**. Le QR est réservé à l’accès à la réception. Le design ivoire, marine et or est conservé.

## Configuration Supabase

1. Créer un projet Supabase. Choisir une région accessible depuis Ouagadougou et conserver le mot de passe PostgreSQL dans un gestionnaire de secrets.
2. Exécuter **une fois** `supabase/migrations/001_wedding.sql` dans SQL Editor. Alternative avec la CLI : `supabase link --project-ref ...` puis `supabase db push`. Ne pas relancer manuellement la migration après création des tables.
3. Dans Authentication, désactiver les inscriptions publiques. Créer un compte administrateur et des comptes individuels pour les agents via le tableau de bord Auth (Add user). Pour les comptes créés directement, confirmer leur e-mail via le tableau de bord. Ne pas utiliser un compte partagé si vous voulez identifier chaque agent dans le journal.
4. Copier leurs UUID dans SQL Editor et attribuer les rôles :

```sql
insert into public.staff_roles(user_id,role) values
('UUID-DU-COMPTE-ADMIN','admin'),
('UUID-DU-COMPTE-AGENT','accueil')
on conflict(user_id) do update set role=excluded.role;
```

5. Configurer les variables serveur dans `.env.local` :

```dotenv
DEMO_MODE=false
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-cle-publique
SUPABASE_SERVICE_ROLE_KEY=votre-cle-service-role
APP_URL=http://127.0.0.1:3000
```

La clé publique peut être exposée, mais **la clé service_role ne doit jamais porter le préfixe NEXT_PUBLIC ni être envoyée à un invité**. Les RPC invité ne sont accessibles que par le backend Next.js. Les mutations staff utilisent la session du personnel, puis vérifient son rôle en base. RLS ne permet aucune écriture directe aux utilisateurs, même admin. `user_metadata` n’attribue aucun rôle.

6. Pour la recette exclusivement, exécuter `supabase/seed.sql`. Il crée cinq invitations fictives avec des tokens aléatoires. Ne pas charger ce seed dans la base du mariage réel. Ne pas confondre le nombre d’invitations avec le nombre de places.
7. Dans Auth, configurer Site URL avec le domaine final. Utiliser la fonction de récupération de compte du tableau de bord Supabase si un organisateur oublie son mot de passe ; la V1 ne possède pas de page de récupération.

## Règles et sécurité

- Invitation : un quota, une réponse, un compteur d’admissions, **un seul QR** pour tout le groupe.
- Réponse « présent » : entier entre 1 et le quota ; « absent » : zéro. Réponse publique modifiable avant **le 16 octobre 2026 à 18:00 à Ouagadougou (UTC)**, et avant la première entrée. Un admin peut ensuite corriger avec motif.
- Admission : seulement invitation active et confirmée ; le nombre entré ne dépasse jamais le confirmé. Les `CHECK` PostgreSQL garantissent `0 ≤ admis ≤ confirmé ≤ quota`.
- Deux agents : `SELECT ... FOR UPDATE` sérialise l’admission de la même invitation. La seconde transaction vérifie le compteur mis à jour. L’UUID de requête et un verrou transactionnel évitent la double admission lors d’un réessai réseau, y compris deux réessais simultanés.
- QR : uniquement le token de pass, aucun nom/téléphone, aucune URL RSVP. Tokens indépendants générés avec deux UUID v4 concaténés (244 bits aléatoires effectifs), ou 32 octets cryptographiques en démo. Un token est un secret porteur : ne pas le publier, ne pas le transmettre à un groupe WhatsApp. L’agent vérifie le nom annoncé ; le système ne prouve pas l’identité du porteur.
- Cookies de session Supabase vérifiés avec `getUser`, Proxy de rafraîchissement. Contrôle du rôle dans chaque API et chaque RPC. Origine vérifiée pour les mutations, limite de taille, schémas Zod, protection de base contre les abus publics par compteur PostgreSQL.
- RLS : admin lit les invitations et audits, accueil accède seulement aux RPC filtrées, aucun accès anonyme aux tables. Les agents ne reçoivent jamais les liens RSVP/pass ni les commentaires internes.
- Définir APP_URL exactement avec le domaine utilisé (sans slash final), sinon les mutations sont refusées. Avec Vercel utiliser le domaine stable du mariage, pas un domaine de preview avec les mêmes variables.
- En-têtes : no-store, no-referrer, nosniff, refus d’iframe, caméra limitée à l’origine. CSP de base ; `unsafe-inline` demeure nécessaire pour le bootstrap Next.js dans cette V1. Pas d’analytics ni de services tiers sur les invitations.
- Toutes les admissions et corrections sont journalisées ; aucune suppression via l’interface. Conserver les comptes Auth désactivés plutôt que les supprimer si leur historique doit être conservé.
- Export CSV protège les cellules commençant par des caractères de formule Excel. Il contient des données personnelles : stockage privé. Les tokens ne sont pas exportés.
- La capacité de 300 produit une alerte si dépassée ; elle ne bloque pas les invitations. Les quotas individuels restent stricts.

Voir `docs/ARCHITECTURE.md` pour les choix détaillés et `docs/RECETTE.md` pour le plan de vérification.

**Phase de finition, aucun déploiement de production effectué :** voir [le dossier à valider](docs/PRE_DEPLOIEMENT.md) (schéma final, RLS, variables, comptes, migration, sauvegarde et checklist) et [le parcours complet sur téléphone](docs/TEST_TELEPHONE.md) (test Wi-Fi HTTPS, caméra et deux téléphones). Serveur local de test : `pnpm phone:test 192.168.1.65`, certificat `.phone-test/ca.cer` à approuver sur les téléphones. Sauvegarde locale : `pnpm export:demo` ou `node scripts/export-demo.mjs .demo-phone/data.json` pour la démo Wi-Fi.

Références techniques : [Proxy Next.js](https://nextjs.org/docs/app/api-reference/file-conventions/proxy), [Auth Supabase côté serveur](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs).

## Import et export

Importer un **CSV UTF-8** exporté d’Excel (séparateur virgule ou point-virgule détecté). En-têtes :

```text
Nom;Téléphone;Catégorie;Nombre de places;Commentaire
Famille OUEDRAOGO;+22670000000;Famille marié;5;Exemple
```

Voir `examples/invites.csv`. Aperçu avant validation. Maximum 500 lignes et 1 Mo. Une erreur annule l’import entier. Pas de fusion automatique des doublons : vérifier les noms avant de valider. Le nom, le quota et la catégorie sont obligatoires dans le formulaire ; à l’import la catégorie absente devient Amis. Pas d’import XLSX binaire. L’export peut être ouvert dans Excel ; son schéma comporte des colonnes de suivi et ne sert pas à mettre à jour les invitations existantes.

WhatsApp : l’admin ouvre un message prérempli et effectue l’envoi. **Marquer comme envoyée** est une opération distincte, car ouvrir WhatsApp ne garantit pas l’envoi. Aucun message envoyé automatiquement.

## Déploiement Vercel

1. Mettre le projet dans un dépôt Git privé et l’importer dans Vercel. Framework Next.js, Node 22/24, installation `pnpm install --frozen-lockfile`, build `pnpm build`.
2. Dans Environment Variables, définir les quatre variables Supabase et APP_URL ci-dessus ; DEMO_MODE=false et aucune variable DEMO_PASSWORD. Définir APP_URL avec le domaine HTTPS définitif. Les clés service doivent rester limitées aux environnements voulus.
3. Déployer, puis configurer le domaine choisi avant de partager les liens. Un changement de domaine change les URLs partagées ; conserver l’ancien domaine en redirection si nécessaire.
4. Vérifier HTTPS (caméra), permissions caméra Safari/Chrome, Auth, RPC et RLS, puis exécuter toute la recette avec des invitations dédiées. Le seed et les comptes de démonstration ne doivent pas être dans la base réelle.
5. Désactiver l’indexation est configuré ; garder néanmoins les liens privés. Vérifier les quotas/offres et la politique d’usage actuelle des hébergeurs avant la mise en ligne, sans présumer que l’offre gratuite est permanente.

La V1 n’a besoin ni de stockage fichiers Supabase ni d’API WhatsApp payante. Le domaine personnalisé peut être payant. Le serveur de démonstration local et son disque ne doivent pas être déployés sur Vercel.

## Connexion et PWA

Connexion requise pour consulter à nouveau ou enregistrer une opération. En mode avion, aucune admission n’est mise en file. Le manifeste permet une installation facultative selon le navigateur ; le service worker cache seulement une page de secours générique et l’icône. Les interfaces privées, les invitations et l’API restent **network-only**.

Avant la réception : charger les pages, enregistrer le QR invité ou imprimer le pass, tester le réseau de la salle, prévoir batteries et deux opérateurs mobiles. Les informations déjà affichées restent visibles tant que la page reste ouverte, mais leur compteur peut être obsolète. Aucune confiance ne doit être accordée à un compteur hors connexion.

En cas de réponse réseau perdue après admission, l’interface conserve l’UUID en mémoire et dans sessionStorage (identifiant technique et quantité seulement) et propose de réessayer la même opération. Un rechargement du même onglet reprend l’opération en attente. **Ne pas fermer l’onglet ni changer de compte avant résolution**. Une panne complète du téléphone impose au responsable de vérifier l’historique et les compteurs avant de reprendre. En secours papier, désigner un seul responsable et suspendre le scan pendant les admissions papier ; réconcilier les compteurs et motifs via l’admin avant reprise.

## Vérifications de développement

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Si Chrome est déjà installé, sous PowerShell : `$env:PLAYWRIGHT_CHANNEL='chrome'` puis `pnpm test:e2e`. Tests navigateur en démo exclusivement, serveur dev automatiquement lancé. Ne pas lancer build et dev en même temps car ils partagent `.next`.

Les tests SQL exécutent la migration complète dans PostgreSQL embarqué PGlite, avec rôles anon/authenticated/service_role et Auth simulée. PGlite sérialise les requêtes d’un même moteur : le test local de concurrence n’est **pas** une preuve à deux connexions indépendantes.

### Recette réelle à deux sessions Supabase

Configurer `.env.test` à partir de `.env.test.example` avec un **projet de recette** et trois comptes distincts : un admin et deux agents accueil. Ne pas fournir de clé service à ce test. Exécuter :

```sh
node --env-file=.env.test scripts/test-supabase.mjs
```

Le test crée une invitation dédiée via admin, lance deux admissions de 2 pour 3 places en parallèle avec les deux comptes accueil, exige un seul succès, puis teste deux réessais simultanés du dernier siège. Il vérifie aussi qu’un agent ne peut pas créer une invitation. Il annule l’invitation en fin de test et conserve son audit. Les comptes/projet Supabase ne sont pas fournis dans ce workspace : cette recette doit encore être exécutée sur le projet configuré.

## Organisation du code

```text
src/app/             Pages App Router et route API
src/components/      UI invité, admin, accueil, navigation, connexion
src/lib/             Validation métier, Auth, Supabase, démo, CSV
src/proxy.ts         Rafraîchissement Auth côté serveur
supabase/migrations/ Schéma, contraintes, RLS et RPC transactionnelles
supabase/seed.sql     Invitations fictives de recette
public/              Manifeste, icône, service worker, secours offline
tests/               Métier, migration SQL et E2E mobile/desktop
scripts/             Test Supabase à deux connexions
docs/                Architecture, recette et revue
examples/            Modèle CSV
```

Textes français centralisés en partie dans `domain.ts` (configuration, catégories) et composants par parcours. Une traduction pourra extraire les textes dans des dictionnaires sans changer le modèle. Les données d’invités ne sont pas des traductions.

## Après le mariage

Exporter le journal et la liste dans un emplacement privé si nécessaire, désactiver les agents et supprimer les données personnelles lorsqu’elles ne sont plus utiles. Définir la durée avec les mariés. Un export ne constitue pas une sauvegarde restaurable de la base : prévoir une sauvegarde PostgreSQL privée via les outils Supabase, vérifier sa restauration sur un projet séparé avant le jour J.

## Déploiement de recette

Voir [le guide étape par étape](docs/DEPLOIEMENT_RECETTE.md) pour l’audit final, GitHub, Supabase réel, les variables Vercel et les points d’arrêt avant migration/publication. Aucun secret ne doit être transmis dans le chat.
