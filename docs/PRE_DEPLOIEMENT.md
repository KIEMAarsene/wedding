# Dossier à valider avant production — finition V1

**Aucun déploiement de production effectué.** Architecture et identité visuelle conservées. Les changements concernent le programme, les explications du pass, le masquage des contrôles de démonstration en production et la fiabilité des interfaces. La migration SQL finale reste `supabase/migrations/001_wedding.sql` ; aucune nouvelle table métier n’est nécessaire.

## Schéma Supabase final

| Table         | Colonnes principales                                                                                                                                                   | Rôle et contraintes                                                                                                                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invitations` | `id` UUID, `code`, `name`, `phone`, `category`, `comment`, `quota`, `confirmed`, `admitted`, `status`, `active`, `sent_at`, `invite_token`, `pass_token`, `created_at` | Un groupe par ligne, un QR par groupe. Code unique. Deux secrets aléatoires indépendants. `1 ≤ quota ≤ 300`, `0 ≤ admitted ≤ confirmed ≤ quota`. Confirmé implique ≥ 1 personne ; sans réponse/refus implique 0. |
| `staff_roles` | `user_id` UUID → `auth.users`, `role`                                                                                                                                  | Un rôle `admin` ou `accueil` par compte. Attribution exclusivement par console SQL privilégiée.                                                                                                                  |
| `admissions`  | `request_id` UUID PK, `invitation_id`, `actor_id`, `count`, `created_at`                                                                                               | Quantité > 0 ; FKs invitation et utilisateur Auth. Identifiant unique d’une opération, conservé lors des réessais.                                                                                               |
| `audit_log`   | `id`, `invitation_id`, `actor_id`, `action`, `details` JSONB, `created_at`                                                                                             | Journal des créations/éditions/RSVP/admissions/corrections/envois/annulations/rotations. Aucun effacement par l’interface.                                                                                       |
| `rate_limits` | `key`, `window_start`, `count`                                                                                                                                         | Clé composée empreinte IP/fenêtre minute ; protection des endpoints publics, pas une preuve d’identité.                                                                                                          |

PostgreSQL génère les UUID et tokens (deux UUID v4 concaténés, 244 bits aléatoires effectifs par token). La séquence `invitation_code_seq` crée les codes `AG-XXXX`. L’accès invité utilise le secret d’invitation ; le QR contient seulement le secret du pass, qui n’autorise pas la modification du RSVP.

### Transactions et concurrence

La fonction `admit` vérifie le rôle, prend un verrou transactionnel sur l’UUID de requête, reconnaît les réessais, puis verrouille la ligne d’invitation avec `SELECT ... FOR UPDATE`. Elle refuse une invitation annulée, non confirmée, complète ou une quantité supérieure au restant. Compteur, admission et audit sont écrits dans la même transaction.

Exemple : 3 confirmés, deux téléphones affichent 3 places et demandent 2 chacun. Le premier consomme 2 ; le second attend le verrou, lit **1 restante** et est refusé. Ni le scan ni une recherche ne consomment de place. Les contraintes de table empêchent également une écriture incohérente.

RSVP, annulation, changement du quota et corrections utilisent la même ligne verrouillée. Une correction admin est une intervention explicite journalisée, pas une admission silencieuse. Un RSVP ne peut plus changer après la première entrée. La réponse publique ferme le 16 octobre à 18 h UTC/Ouagadougou.

## Politiques RLS et privilèges

RLS est activée sur les cinq tables. Aucun utilisateur final ne peut écrire directement dans une table, même un administrateur. Les fonctions `SECURITY DEFINER` ont `search_path=''` et vérifient les rôles depuis la table, jamais depuis `user_metadata`.

| Accès            | Anonyme / invité | Compte accueil             | Compte admin                         | Backend `service_role`               |
| ---------------- | ---------------- | -------------------------- | ------------------------------------ | ------------------------------------ |
| `staff_roles`    | Aucun            | Lecture de son propre rôle | Lecture de son propre rôle           | Accès privilégié                     |
| `invitations`    | Aucun            | Aucun SELECT direct        | SELECT selon `invitation_admin_read` | Accès privilégié                     |
| `admissions`     | Aucun            | Aucun SELECT direct        | SELECT selon `admissions_admin_read` | Accès privilégié                     |
| `audit_log`      | Aucun            | Aucun SELECT direct        | SELECT selon `audit_admin_read`      | Accès privilégié                     |
| `rate_limits`    | Aucun            | Aucun                      | Aucun                                | Compteur serveur                     |
| Écriture directe | Interdite        | Interdite                  | Interdite                            | Réservée aux opérations privilégiées |

`role_read_self` autorise uniquement `user_id=auth.uid()`. Les trois politiques admin exigent `staff_role()='admin'`.

RPC autorisées aux comptes authentifiés : `staff_search`, `staff_scan`, `admit` pour les rôles équipe ; `admin_save`, `admin_action`, `admin_import` pour admin uniquement. `staff_role` et `require_staff` servent ces contrôles. La recherche et le scan n’exposent ni secrets de liens ni commentaire interne aux agents. Un compte Auth dépourvu de rôle est refusé.

`guest_invitation`, `guest_rsvp` et `consume_rate_limit` sont exécutables par le backend `service_role` uniquement. Leur accès `PUBLIC`, `anon` et `authenticated` a été révoqué explicitement. L’invité passe par l’API Next.js, validée, limitée et sans cache. La clé service contourne RLS : ne jamais la placer côté navigateur.

## Variables d’environnement

| Variable                        | Local démonstration                        | Supabase réel / Vercel                               | Exposition                                                       |
| ------------------------------- | ------------------------------------------ | ---------------------------------------------------- | ---------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Vide                                       | URL du projet voulu, distincte entre recette et réel | Publique                                                         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vide                                       | Clé publique/anon du même projet                     | Publique ; RLS indispensable                                     |
| `SUPABASE_SERVICE_ROLE_KEY`     | Vide                                       | Clé service du même projet                           | Secret serveur                                                   |
| `APP_URL`                       | `http://127.0.0.1:3000` ou URL Wi-Fi HTTPS | Origine HTTPS exacte utilisée par le navigateur      | Configuration serveur du contrôle d’origine                      |
| `DEMO_MODE`                     | `true`                                     | `false`                                              | Serveur ; démo interdite aussi par NODE_ENV production et VERCEL |
| `DEMO_PASSWORD`                 | Mot de passe local                         | **Absent**                                           | Secret local uniquement                                          |
| `PHONE_TEST_HOST`               | Seulement script test Wi-Fi                | **Absent**                                           | Local uniquement                                                 |

Le mode recette avec Supabase utilise aussi `DEMO_MODE=false`. Production ne montre ni bouton démo, ni bannière, ni sélection de rôle démo, ni route de téléchargement du certificat de test. La connexion applique le rôle réellement attribué en base.

Pour Vercel, isoler les variables Preview et Production et fixer un domaine de recette stable pour `APP_URL`. Utiliser une base Supabase de recette distincte ; une preview ne doit pas accéder aux vrais invités. La séparation des variables par environnement est prévue par [Vercel](https://vercel.com/docs/environment-variables).

## Création et retrait des comptes

1. Créer le projet Supabase de recette et appliquer **une seule fois** `001_wedding.sql` dans SQL Editor. Ne pas lancer le seed dans le projet réel.
2. Désactiver les inscriptions publiques dans Auth. Dans Authentication → Users, créer/ajouter un utilisateur admin et un utilisateur par agent. Confirmer leur e-mail selon la méthode de création retenue. Utiliser des mots de passe distincts.
3. Copier les UUID des utilisateurs Auth et attribuer les rôles avec SQL Editor :

```sql
insert into public.staff_roles(user_id, role) values
('UUID-ADMIN', 'admin'),
('UUID-AGENT-A', 'accueil'),
('UUID-AGENT-B', 'accueil')
on conflict(user_id) do update set role=excluded.role;
```

4. Vérifier que l’admin voit Admin et Accueil, que les agents voient uniquement Accueil, et que les agents ne peuvent appeler une API/RPC admin ou lire la table invitations directement. Un utilisateur Auth sans rôle ne peut pas entrer dans l’espace équipe.
5. Pour retirer l’accès d’un agent : supprimer sa ligne `staff_roles` via SQL Editor, puis désactiver son accès Auth. Conserver le compte pour garder ses références dans l’historique ; ne pas le supprimer sans traiter ces références.
6. Garder l’accès à la console Supabase chez les responsables uniquement. Le mot de passe de démonstration n’est pas un compte de production. La V1 n’a pas de gestion des comptes depuis l’interface mariage : la console est le point d’administration des comptes.

## Migration de la démo vers le réel

Le passage ne consiste pas à charger `.demo/data.json` dans PostgreSQL : il contient des invités fictifs, des admissions de test, des identifiants de comptes locaux et parfois des tokens fixes.

1. Sauvegarder la démo avant toute opération : `pnpm export:demo`. Le script a été exécuté ici ; fichiers datés dans `.private-backups/` (ignorés par Git).
2. Le JSON conserve toute la démo, incluant les tokens. Il est destiné à une sauvegarde privée locale. Le CSV `invites-import-...csv` propose uniquement les champs d’invitation et les lignes actives. Examiner ce CSV dans un éditeur texte et **retirer les lignes fictives et de recette**, ainsi que les doublons. `invites-excel-...csv` neutralise les formules pour consultation Excel ; il ne sert pas à réimporter les téléphones.
3. Privilégier la liste originale réelle des mariés, au format `Nom;Téléphone;Catégorie;Nombre de places;Commentaire`, plutôt qu’une démo nettoyée si elle n’a servi qu’aux essais.
4. Configurer une base de recette, importer le CSV nettoyé avec aperçu, comparer les noms, catégories et sommes de quotas. L’import est transactionnel ; une ligne invalide annule tout le lot.
5. Après validation du dossier et de la recette, configurer le projet réel, créer les comptes puis importer seulement la liste réelle. Le système crée **de nouveaux liens et QR**, avec réponses en attente et admissions à zéro. Il ne reprend ni RSVP ni admissions fictives. Les liens de démonstration ne doivent pas être distribués aux invités réels.
6. Réexporter immédiatement la liste réelle et comparer les totaux à la source. Vérifier capacité 300, absence de doublons, noms et téléphones. La capacité est une alerte, les quotas individuels sont bloquants.
7. Stabiliser le domaine avant envoi ; préparer WhatsApp et marquer « envoyée » seulement après l’envoi effectif. Si de vrais liens avaient déjà été envoyés depuis la démo, établir un plan de remplacement avant le basculement.

## Sauvegarde et export des invités

**Export de suivi** : bouton Exporter dans Admin pour la liste et export du Journal pour ses 200 dernières opérations. Ces CSV ne contiennent pas les tokens ; ils servent au suivi et ne restaurent ni liens, ni comptes, ni journal complet. Leur téléphone peut être précédé d’une apostrophe pour éviter une formule Excel. Ne pas réimporter l’export de suivi tel quel.

**Sauvegarde restaurable** : utiliser Supabase CLI et Docker, une connexion PostgreSQL conservée dans un secret local. Les dumps peuvent contenir comptes et secrets : stockage privé hors dépôt, copie hors du PC et accès limité. Le schéma, les rôles et les données se sauvegardent séparément selon la [procédure officielle Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

Exemple PowerShell, après avoir défini `$env:WEDDING_DB_URL` dans une session privée :

```powershell
New-Item -ItemType Directory -Force .private-backups/db
supabase db dump --db-url $env:WEDDING_DB_URL -f .private-backups/db/roles.sql --role-only
supabase db dump --db-url $env:WEDDING_DB_URL -f .private-backups/db/schema.sql
supabase db dump --db-url $env:WEDDING_DB_URL -f .private-backups/db/data.sql --use-copy --data-only -x storage.buckets_vectors -x storage.vector_indexes
```

Restaurer d’abord dans un projet Supabase **séparé et vide**, avec `psql`, en suivant la procédure officielle, jamais par-dessus le réel pour essayer. Vérifier ensuite les comptes/rôles, séquences, tokens, index/RLS, compteurs et audit. Reconfigurer les URLs et clés applicatives du projet restauré. Tester une connexion admin/agent et une admission sur une invitation dédiée. La restauration et les dumps externes n’ont pas été exécutés ici sans accès Supabase. Prévoir une sauvegarde avant import, après validation des RSVP et avant la réception.

## Préparation Vercel, puis arrêt avant production

Code, lockfile, variables et checklist sont prêts. Une recette HTTPS locale est disponible sans hébergement. Une future preview Vercel peut utiliser Supabase de recette et la protection d’accès de la plateforme ; prévoir l’accès des téléphones testeurs.

Ne pas importer/pousser le dépôt dans un projet configuré pour auto-déployer la branche de production avant l’accord : cette opération peut lancer un déploiement. Aucun `vercel --prod`, aucune promotion de preview et aucun branchement du domaine réel pendant cette phase. Après votre validation explicite : projet Next.js, Node 22/24, `pnpm install --frozen-lockfile`, `pnpm build`, variables Production séparées, domaine HTTPS stable.

## Checklist de recette et décision de mise en production

- [ ] Programme : 11h00 Église Saint Camille ; 13h30 Mairie de Bogodogo ; 14h30 Espace Dieudonné – Salle Princesse. Validation des mariés.
- [ ] Pass : nombre confirmé et numéro explicites, QR pour la réception, explication des arrivées séparées et de l’épuisement des places.
- [ ] Aucune mention/commande de démo sur accueil/login/Admin/Accueil en production ; route `/test-ca` 404.
- [ ] Individuel 1, couple 2, famille 5, confirmation 3 sur 5 ; dépassement RSVP et admission refusés côté serveur.
- [ ] Entrées 2 puis 1 : compteur 2/3 puis 3/3 ; nouveau scan complet expliqué, aucune 4e personne.
- [ ] Deux téléphones avec comptes distincts demandent simultanément 2 pour 3 : un succès, un refus et 1 place restante ; finaliser avec 1.
- [ ] Exécuter `scripts/test-supabase.mjs` sur le projet réel de **recette**, avec sessions Auth distinctes. La validation locale sérialisée ne remplace pas ce test.
- [ ] Perte de réponse réseau : réessai et rechargement du même onglet ne doublent pas l’admission ; aucun enregistrement offline.
- [ ] Invitation annulée, sans réponse, refusée et QR inconnu : messages précis ; recherche manuelle sans QR.
- [ ] Agents sans droits admin, comptes sans rôle et sessions absentes refusés ; aucune écriture directe et aucun secret dans le bundle client.
- [ ] Import/export vérifiés ; sauvegarde complète restaurée sur une base séparée ; journal conservé lors des corrections.
- [ ] Dashboard mis à jour après une admission : invitations distinctes des personnes, places restantes correctes, catégories correctes. Actualisation toutes les 15 s ou bouton Actualiser.
- [ ] Caméra réelle iPhone/Android, QR écran et papier, HTTPS, autorisations, Wi-Fi/réseau mobile de la salle testés.
- [ ] Liste réelle nettoyée, domaine fixé, mots de passe uniques, batteries et responsable de secours préparés.
- [ ] Votre accord explicite enregistré avant toute mise en production.

Voir aussi `RECETTE.md` pour la répétition sur place et `TEST_TELEPHONE.md` pour le parcours Wi-Fi complet. Les comptes/projets Supabase et Vercel ne sont pas fournis ; les points externes de cette checklist restent à exécuter.
