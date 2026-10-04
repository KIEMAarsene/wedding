# Déploiement de recette — étapes contrôlées

État au 5 octobre 2026 : aucun projet distant modifié, aucun dépôt poussé, aucun déploiement effectué. Les vrais invités restent exclus de cette phase. Fonctionnalités et design conservés.

## Audit local

- Build Next.js de production réussi ; TypeScript et ESLint réussis.
- 35 tests unitaires/SQL et 16 tests navigateur desktop/mobile réussis.
- Audit npm des dépendances de production : aucune vulnérabilité connue signalée à cette date. Ce résultat ne garantit pas l'absence de vulnérabilités inconnues.
- Audit complet : Vitest mis à jour de 3.2.7 à 4.1.11 pour corriger GHSA-82fw-gwwq-j7x9 ; 35 tests relancés avec succès. Une alerte haute subsiste sur `braces@3.0.3`, dépendance transitive du lint (GHSA-vfj7-8cjw-p6xm, risque de déni de service sur motifs profondément imbriqués). Le registre annonce 3.0.3 comme dernière version disponible, malgré le correctif 3.0.4 indiqué par l'audit. Aucune surcharge vers une version absente n'est conservée. Les motifs du lint sont contrôlés par le dépôt ; cette dépendance n'est pas une dépendance de production. Réexaminer sa disponibilité avant la mise en production ; l'audit global n'est pas déclaré sans alertes.
- Installation avec lockfile figé réussie avec le runtime local pnpm 11.19.0. Le projet épingle pnpm 10.34.4, disponible sur npm et de la génération prise en charge par Vercel. Confirmer cette version dans le journal du premier build distant.
- `node scripts/audit-secrets.mjs` contrôle les fichiers suivis et publiables, les valeurs sensibles de `.env.local`/`.env.test` et les artefacts client de `.next`. Il affiche uniquement les noms de fichiers en cas d'échec. C'est un contrôle heuristique, à compléter par la revue Git.
- Mot de passe de démo retiré des tests et des guides. Pour lancer les tests locaux : `node --env-file=.env.local node_modules/@playwright/test/cli.js test`. La valeur reste uniquement dans l'environnement privé local.
- `.env*` (sauf modèles vides), `.phone-test`, clés/certificats, `.demo`, `.demo-phone`, sauvegardes, `.vercel` et `.supabase` exclus par Git. `.vercelignore` exclut également les données privées lors d'un upload CLI.
- Module Supabase privilégié marqué `server-only`. Aucun `env` public ajouté dans next.config. La démo est refusée en production et sur Vercel ; `/test-ca` y retourne 404.
- Le dossier `.demo` est un stockage de test, jamais un backend Vercel. Le code de simulation et le seed fictif peuvent être versionnés ; les fichiers de données locaux et leurs identifiants ne le sont pas.

## 1. GitHub : authentification personnelle

Connectez-vous vous-même à [GitHub](https://github.com/new). Créez un dépôt **privé**, dans votre compte personnel, par exemple `wedding`, vide : sans README, licence ou gitignore générés. N'activez pas encore une intégration Vercel.

Communiquez uniquement son URL HTTPS, qui n'est pas un secret. Le commit local peut être préparé directement dans ce projet. Le push utilisera Git Credential Manager : connectez-vous dans la fenêtre navigateur qui s'ouvre, avec votre éventuelle double authentification. Aucun token ni mot de passe ne doit être collé dans le chat, une commande ou l'URL du remote. Si l'authentification n'est pas disponible, GitHub Desktop peut publier le dépôt existant depuis ce dossier, avec l'option privée.

Ne poussez que le commit revu. Vérifiez `git status`, `git diff --cached --stat`, `git ls-files` et `node scripts/audit-secrets.mjs` avant chaque publication. Aucun secret n'était présent dans un historique antérieur : le dépôt n'avait aucun commit au début de l'audit.

## 2. Supabase : projet de recette et aperçu avant migration

Connectez-vous vous-même à [Supabase](https://supabase.com/dashboard), choisissez Free si disponible, créez un projet distinct nommé `wedding-recette`. Choisissez une région adaptée et conservez le mot de passe PostgreSQL dans votre gestionnaire de mots de passe. Il n'est pas nécessaire de me le transmettre.

La migration à relire est [001_wedding.sql](../supabase/migrations/001_wedding.sql). Sur une base vierge elle crée :

| Objet              | Contenu                                                                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5 tables           | `staff_roles`, `invitations`, `admissions`, `audit_log`, `rate_limits`                                                                                                     |
| 1 séquence         | `invitation_code_seq`, codes AG-XXXX                                                                                                                                       |
| 2 index explicites | recherche par nom et journal par date, en plus des index PK/UNIQUE                                                                                                         |
| 4 politiques RLS   | rôle propre ; lecture invitations, admissions et audit réservée admin                                                                                                      |
| 11 fonctions/RPC   | `staff_role`, `require_staff`, `guest_invitation`, `guest_rsvp`, `staff_search`, `staff_scan`, `admit`, `admin_save`, `admin_action`, `admin_import`, `consume_rate_limit` |
| Contraintes        | `0 ≤ admitted ≤ confirmed ≤ quota ≤ 300`, statut cohérent, tokens et codes uniques, références Auth/admissions/audit                                                       |
| Privilèges         | aucune écriture directe anon/authenticated ; invité via backend service_role ; staff via RPC vérifiant son rôle                                                            |

`admit` verrouille la ligne avec `FOR UPDATE`, contrôle le restant, puis écrit compteur, admission et audit dans la même transaction. UUID de requête et verrou transactionnel protègent également les réessais. Le dossier [PRE_DEPLOIEMENT.md](PRE_DEPLOIEMENT.md) détaille colonnes, RLS et sauvegardes.

Cette migration ne crée aucun compte Auth ni invité, ne modifie pas le schéma Auth et ne supprime aucune table. Elle n'est pas idempotente : ne pas la réexécuter à l'aveugle. Vérifier d'abord que les cinq tables n'existent pas. Après accord explicite sur le projet de recette et cet aperçu, l'exécuter une seule fois dans SQL Editor, en entourant le contenu complet de `BEGIN;` et `COMMIT;` pour éviter une installation partielle. Aucune migration distante n'a été exécutée durant l'audit.

## 3. Comptes et authentification

Dans Supabase → Authentication → Users → Add user, créez votre compte et deux comptes d'agents pour la recette. Saisissez les mots de passe directement dans Supabase et conservez-les dans un gestionnaire privé. Activez la confirmation du compte lors de sa création administrative. Désactivez l'inscription publique dans la configuration du fournisseur Email ; la connexion utilise e-mail/mot de passe, sans inscription dans l'application.

Dans SQL Editor, attribuez les rôles avec les UUID affichés dans Users (ces UUID ne sont pas des mots de passe) :

```sql
insert into public.staff_roles(user_id, role) values
  ('UUID_ADMIN_A_REMPLACER'::uuid, 'admin'),
  ('UUID_AGENT_1_A_REMPLACER'::uuid, 'accueil'),
  ('UUID_AGENT_2_A_REMPLACER'::uuid, 'accueil');
```

Ne pas utiliser `user_metadata` pour attribuer des privilèges. Un utilisateur sans ligne dans staff_roles est refusé. La suppression d'une ligne de rôle retire immédiatement l'accès métier aux prochaines requêtes. Préférer la désactivation d'un agent à sa suppression Auth si des admissions le référencent.

Il n'y a pas de route de récupération de mot de passe dans cette V1 : administrer les comptes depuis Supabase. Ne pas ajouter une URL de callback fictive ni modifier les fonctionnalités validées pour cette phase.

## 4. Variables Vercel

Saisir les valeurs directement dans Vercel → Project → Settings → Environment Variables. Ne pas les envoyer dans le chat. Créer un projet Vercel réservé à la recette et limiter ses valeurs Supabase à ce projet. Le futur projet de production utilisera une autre base et d'autres clés.

| Variable                        | Exposition                      | Valeur de recette                                                     |
| ------------------------------- | ------------------------------- | --------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Publique                        | URL du projet Supabase recette                                        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publique                        | clé anon/public du même projet                                        |
| `SUPABASE_SERVICE_ROLE_KEY`     | **Secrète, serveur uniquement** | clé service_role de ce projet ; aucun préfixe NEXT_PUBLIC             |
| `APP_URL`                       | Non secrète, utilisée serveur   | origine HTTPS exacte et stable de recette, sans chemin ni slash final |
| `DEMO_MODE`                     | Non secrète                     | `false`                                                               |
| `ENABLE_EXPERIMENTAL_COREPACK`  | Non secrète, build              | `1` pour respecter pnpm épinglé                                       |

Ne définir ni `DEMO_PASSWORD`, ni `PHONE_TEST_HOST`, ni variables TEST_* sur Vercel. Ne pas ajouter de `NODE_ENV` manuel. URL/clé anon se trouvent dans les paramètres API Supabase ; la clé legacy service_role est privilégiée et doit être traitée comme un secret. RLS protège l'utilisation de la clé publique.

Le framework est Next.js, racine du dépôt, Node 24.x et build `pnpm build` (vercel.json préparé). Laisser Vercel détecter la commande d'installation/Corepack ; ne pas forcer une ancienne version de pnpm avec une surcharge imprécise. Aucune commande de seed ou de migration dans le build.

## 5. URL HTTPS et déploiement de recette

Après authentification et autorisation du déploiement, importer le dépôt privé dans un projet Vercel dédié `wedding-recette`. **Le bouton Deploy lance une publication** : prévenir avant cette étape. Même si Vercel appelle le premier environnement « Production », ce projet est uniquement la recette : base fictive, domaine de recette, aucun vrai invité. La production du mariage sera un projet séparé après validation.

Fixer le domaine `<projet-recette>.vercel.app`, renseigner exactement cette origine dans APP_URL, puis déployer à nouveau si la valeur a changé. Les POST sont refusés si l'origine diffère : utiliser ce domaine stable pour tout le parcours, plutôt que des URLs de déploiement changeantes.

Supabase → Authentication → URL Configuration : Site URL = cette origine HTTPS. Autoriser seulement les URLs de redirection réellement utilisées sur ce domaine, notamment `/login` ; pas de wildcard global. La connexion actuelle par mot de passe n'utilise aucun callback OAuth. La protection d'accès Vercel éventuelle doit permettre aux testeurs de consulter l'invitation et aux agents d'utiliser la caméra. HTTPS public ne nécessite aucune CA locale.

## 6. Données fictives et recette distante

Après migration et connexion admin, créer via l'interface une invitation `RECETTE FAMILLE` de quota 5 et une `RECETTE CONCURRENCE` dédiée au test. L'import [recette-minimale.csv](../examples/recette-minimale.csv) est une alternative avec aperçu. Ne pas charger `.demo/data.json` ni la vraie liste. Le seed Supabase est optionnel, fictif et distinct des migrations : ne pas l'exécuter automatiquement.

Sur l'URL HTTPS stable : ouvrir le lien invité, confirmer 3 personnes sur 5, afficher le QR, scanner depuis un vrai téléphone connecté avec le compte accueil, admettre 2 puis scanner et admettre 1. Vérifier refus d'une quatrième personne et dashboard à 3 entrées pour cette invitation, immédiatement via Actualiser ou après le polling de 15 secondes.

Pour la preuve PostgreSQL distante, remplir `.env.test` privé à partir de `.env.test.example`, directement dans un éditeur local sécurisé, avec la base de recette, l'admin et deux agents distincts. Les secrets ne sont ni versionnés ni affichés :

```powershell
node --env-file=.env.test scripts/test-supabase.mjs
```

Le script écrit une invitation dédiée, confirme 3 personnes, envoie simultanément 2+2 depuis deux sessions Auth distinctes, exige un succès/un refus, puis vérifie la dernière entrée, le réessai idempotent et le refus de droits admin à l'agent. Il annule l'invitation en fin de test en conservant l'historique. Ce test reste à exécuter après fourniture des accès dans l'environnement privé ; les tests PGlite locaux ne prouvent pas la concurrence distante.

Tester aussi deux téléphones réels, permission caméra, caméra arrière, QR écran/papier, réseau mobile et Wi-Fi, erreur réseau sans admission hors ligne, QR annulé/inconnu, rôles et sessions expirées. Une émulation mobile ou une caméra simulée ne remplace pas ce contrôle physique.

## PRÊT POUR PRODUCTION — décision après recette

- [ ] Build distant et parcours HTTPS de recette réussis, aucune démo visible, `/test-ca` inaccessible.
- [ ] Secrets absents du dépôt, des bundles client et des logs ; clé service confinée serveur.
- [ ] Comptes admin/agents distincts, RLS et refus de privilèges vérifiés sur Supabase réel.
- [ ] RSVP → QR → entrées 2+1 → quota complet → dashboard validé.
- [ ] Concurrence PostgreSQL distante et deux téléphones validés ; aucune quatrième admission.
- [ ] Caméra physique Android/iPhone testée sur HTTPS public avec les réseaux du lieu.
- [ ] Exports de suivi et sauvegarde restaurable testés dans une base séparée ; pas de confiance dans un backup gratuit automatique.
- [ ] Domaine, APP_URL et URLs Auth définitifs cohérents ; projet/base production séparés.
- [ ] Accord explicite des mariés avant bascule et import de la vraie liste.

Ne pas cocher « prêt » avant les preuves distantes et physiques. Supabase Free permet jusqu'à deux projets gratuits selon les conditions actuelles ; les sauvegardes externes régulières sont nécessaires. Vercel Hobby vise les usages personnels non commerciaux, ce qui convient à ce mariage personnel sous réserve des quotas.

Sources officielles : [Vercel Hobby](https://vercel.com/docs/plans/hobby), [gestionnaires de paquets](https://vercel.com/docs/package-managers), [variables Vercel](https://vercel.com/docs/environment-variables), [Supabase Free](https://supabase.com/docs/guides/platform/billing-on-supabase), [sauvegardes](https://supabase.com/docs/guides/platform/backups), [redirections Auth](https://supabase.com/docs/guides/auth/redirect-urls).
