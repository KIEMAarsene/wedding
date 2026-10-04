# Choix et règles V1

Next.js App Router + TypeScript + Tailwind, Supabase Auth/PostgreSQL et Vercel. Un monolithe, aucune file de messages ni synchronisation offline. Les clés service restent dans les modules serveur. Les sessions sont validées avec getUser et les rôles sont enregistrés dans une table inaccessible en écriture aux utilisateurs. Aucun rôle issu de user_metadata.

## Parcours

- Invité : lien aléatoire → invitation → réponse → pass QR → retour sur le même lien. Aucun compte.
- Administrateur : connexion → statistiques et catégories → création/modification/import → lien WhatsApp préparé → marquage envoyé explicite → export et historique.
- Accueil : connexion avec rôle accueil ou admin → caméra/recherche → vérification → nombre entrant → transaction PostgreSQL → résultat. Actualisation périodique et nouvelle vérification au moment de l'admission.

## Modèle

invitations : identité, code AG séquentiel (non secret), deux tokens aléatoires indépendants de 244 bits effectifs (lien et pass), quota, confirmé, admis, statut, activation, catégorie, commentaire, date d'envoi.
staff_roles : utilisateur Auth → admin ou accueil.
admissions : invitation, nombre, agent, UUID de requête unique, horodatage. Idempotence pour reprendre une réponse réseau perdue.
audit_log : création, édition, envoi, annulation, réponse, admission, correction. Ajout uniquement par fonctions contrôlées.
rate_limits : compteur de requêtes publiques par empreinte IP et minute, nettoyage des anciennes fenêtres à chaque appel.

## Décisions

- Admission uniquement si confirmé, plafonnée au confirmé, lui-même ≤ quota. Un invité sans réponse nécessite une décision admin.
- RSVP modifiable avant le 16/10/2026 à 18:00 UTC (Ouagadougou), jusqu'à la première entrée. Après cela : intervention admin.
- Annuler préserve l'historique et bloque les admissions. Réactiver est possible. Pas de suppression définitive via UI.
- Correction d'admission admin avec motif obligatoire ; nombre absolu compris entre 0 et confirmé. Le journal initial est préservé.
- La capacité de 300 est un indicateur avec alerte, pas un blocage : possibilité d'ajuster la salle. Quota par invitation limité à 300.
- Le QR contient uniquement un token de pass indépendant, jamais nom/téléphone ni lien RSVP. Un partage volontaire reste possible : un porteur de QR peut consommer les places. L'agent vérifie le nom annoncé ; ce système ne prouve pas l'identité.
- Mode démo local sur disque, protégé par mot de passe, interdit en NODE_ENV=production et VERCEL. Utilise les mêmes validations métier ; la garantie multi-instance vient de PostgreSQL, pas du mode démo.
- Import CSV UTF-8 (Excel peut exporter ce format). Validation complète, transaction unique, maximum 500 lignes. Pas d'import XLSX nécessaire pour la V1.
- PWA : manifeste et page de secours générique seulement. Aucune donnée personnelle, page privée, requête API ni admission mise en cache. Les admissions hors ligne sont interdites. Prévoir deux opérateurs mobiles et une liste papier minimale conservée par le responsable ; une seule personne arbitre le secours papier, réconciliation avant de reprendre le scan.
- Tokens : 2 UUID v4 concaténés (244 bits aléatoires effectifs), générés dans PostgreSQL. Tokens de démonstration fixes exclusivement locaux. Rotation admin invalide immédiatement les anciens liens/QR.

## Limites à vérifier avec les mariés

Programme fourni pendant la finition : 11h00 cérémonie religieuse à l’Église Saint Camille, 13h30 mariage civil à la Mairie de Bogodogo et 14h30 réception à l’Espace Dieudonné – Salle Princesse. Le QR contrôle uniquement la réception. La carte originale n’est pas jointe ; palette ivoire, marine et or et typographie serif conservées. Aucun envoi WhatsApp automatique : lien prérempli ouvert par l'admin. Aucun paiement ou fournisseur externe de messagerie.
