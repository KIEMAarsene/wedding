# Revue de la V1

## Garanties construites

Les compteurs reposent sur les contraintes et transactions PostgreSQL. RSVP et admission verrouillent la même ligne. Modifier le quota en-dessous du confirmé est interdit. Corriger un compteur au-delà du confirmé ou corriger une réponse au-dessous des admissions échoue. Aucun accès public aux tables ou aux fonctions publiques RSVP : le backend détient seul la clé service. Les rôles sont issus d’une table contrôlée, jamais du client.

L’agent reçoit les seules données nécessaires à la recherche et à la vérification, sans commentaire ni tokens. Le téléphone est disponible pour la recherche manuelle. Aucune donnée personnelle encodée dans le QR. Les liens et tokens restent des secrets porteurs ; le partage volontaire du pass ne peut pas être empêché techniquement avec un seul QR par invitation.

Le compteur et le journal sont modifiés dans la même transaction. Une correction conserve les événements précédents. Les appels d’admission répétés avec le même UUID, agent, invitation et quantité n’ajoutent pas de personnes. Le verrou par UUID évite les collisions entre invitations.

## Vérifications et limites

Les tests métier et SQL utilisent une date de recette avant la clôture RSVP. Les tests SQL exécutent la migration avec RLS dans PGlite, dont les requêtes locales sont sérialisées. Une validation PostgreSQL distante à deux sessions est fournie par `scripts/test-supabase.mjs`, mais nécessite les accès au projet de recette.

Les tests navigateur vérifient les parcours dans Chrome et l’émulation mobile. Ils ne prouvent pas le fonctionnement optique de la caméra, les permissions Safari ni la qualité de réseau sur place. Ces éléments nécessitent la répétition indiquée dans RECETTE.md.

La PWA n’autorise aucune admission hors ligne et ne stocke aucun pass/page privée dans Cache Storage. Le navigateur peut sauvegarder le PNG du QR à la demande de l’invité. Les requêtes privées portent no-store et no-referrer.

Le rate limit utilise PostgreSQL et n’est pas un anti-DDoS complet. Sur Vercel, activer les protections de la plateforme si nécessaire. Hors Vercel, configurer un reverse proxy de confiance qui remplace l’en-tête IP ; les en-têtes transmis par le client ne doivent pas être utilisés comme preuve d’identité. L’authentification Supabase dispose de ses propres limites. Les sites de preview ne doivent pas partager la base réelle.

L’API limite le corps à 1 Mo après lecture et contrôle Content-Length avant lecture. Pour une exposition plus large, imposer aussi cette limite au reverse proxy. Les logs applicatifs ne doivent pas enregistrer les URL complètes `/i/...` ni les paramètres token ; ne pas activer un service analytique sur ces pages.

## Actions externes restantes

- Créer/configurer Supabase, appliquer la migration, attribuer les comptes et rôles, effectuer la recette réelle.
- Déployer sur Vercel, fixer APP_URL et le domaine HTTPS, tester caméra et connexion sur les téléphones des agents.
- Remplacer les données fictives par la vraie liste et vérifier les invitations avant envoi.
- Faire valider les textes du programme fourni, en conservant l’identité visuelle approuvée.
- Définir une durée de conservation et une sauvegarde/restauration adaptée à l’offre Supabase utilisée.

## Finition et revue approfondie

Le programme fourni est affiché et le pass indique explicitement le nombre confirmé, le code, l’usage à la réception et les arrivées séparées. La sélection du rôle de démonstration est désormais conditionnelle côté serveur ; elle était encore visible dans le formulaire de connexion de la première version. Aucun contrôle de démo n’est rendu en production.

Après scan ou sélection manuelle, la fiche avec compteurs et validation est amenée dans le champ visible du téléphone. Une lecture QR en cours bloque les sélections et admissions d’une ancienne fiche. Les résultats ne consomment aucune place avant validation. Le serveur demeure seul arbitre des places, même si les deux écrans montrent un compteur ancien.

La revue a aussi corrigé un retour idempotent du mode démo qui pouvait inclure les tokens et le commentaire interne. Tous les retours agent de la démo utilisent désormais la même projection sans secrets, comme les RPC PostgreSQL. Les erreurs de modification admin restent visibles après actualisation automatique ; une erreur de chargement distingue les données potentiellement anciennes.

L’admission en attente garde son UUID après un rechargement. Une erreur d’authentification ou de réseau ne supprime plus une opération dont le résultat pourrait être inconnu. Les restrictions de sessionStorage ne font pas passer une admission réussie pour un échec.

Les tests ajoutés couvrent deux sessions navigateur affichant 3 places restantes et demandant chacune 2 : un succès, un refus, puis admission de la dernière personne et contrôle du dashboard. Un test PostgreSQL local soumet 30 demandes pour 3 places ; seulement 3 réussissent. Ces moteurs locaux sont sérialisés ; la recette PostgreSQL distante avec deux comptes accueil distincts reste obligatoire avant production.

Le serveur Wi-Fi HTTPS et le serveur localhost ont des dossiers de build et de données distincts pour éviter les réécritures d’un même fichier de démo depuis deux processus. Le certificat public de test est disponible seulement sur ce serveur local, jamais en production. Aucun certificat n’est installé automatiquement sur un appareil.
