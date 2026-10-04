# Recette avant le 17 octobre 2026

Effectuer une répétition dans un projet Supabase distinct, puis une vérification avec invitations dédiées en production. Annuler les invitations de recette ensuite. Ne jamais utiliser une vraie invitation d’invité pour tester une admission sans remettre explicitement le compteur à zéro avec un motif.

| Scénario                           | Résultat attendu                                 | Vérification automatisée                                          |
| ---------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------- |
| Individuel, quota 1                | RSVP 1, entrée 1, puis complète                  | Métier + SQL                                                      |
| Couple, quota 2                    | RSVP 2, entrée 2                                 | Métier + SQL                                                      |
| Famille, quota 5                   | RSVP jusqu’à 5, un seul QR                       | Métier + SQL + E2E                                                |
| Confirmation de 3 sur 5            | 3 places à l’accueil, aucune 4e                  | SQL + E2E                                                         |
| Requête RSVP 6 sur 5               | Refus serveur, compteur intact                   | SQL + E2E                                                         |
| Groupe entier                      | Admission du groupe, état complet                | SQL                                                               |
| Arrivées 2 puis 1                  | Compteur 2/3 puis 3/3                            | SQL + E2E                                                         |
| Entrée supérieure au restant       | Refus, compteur intact                           | SQL + E2E                                                         |
| Deux agents, 2 + 2 pour 3          | Un succès, un refus, 2 entrées                   | Local SQL + démo E2E ; test-supabase à exécuter avec 2 connexions |
| Réessai même admission             | Une seule opération, même résultat courant       | SQL + E2E ; test-supabase avec 2 réessais parallèles              |
| QR entièrement consommé            | Message précis, aucune nouvelle entrée           | SQL + E2E                                                         |
| Invitation annulée                 | RSVP et admission refusés, historique conservé   | SQL + E2E                                                         |
| Recherche nom/code/téléphone       | Résultats sans secrets de liens                  | SQL + E2E                                                         |
| Invité sans QR                     | Sélection manuelle et admission                  | E2E                                                               |
| Admin sans session                 | Redirection login, API 401                       | E2E                                                               |
| Agent tente une mutation admin     | API/RPC refusent, accès table impossible         | SQL + E2E                                                         |
| Manipulation directe du quota/rôle | UPDATE direct et changement de rôle refusés      | SQL                                                               |
| Import avec ligne invalide         | Aucun ajout, retour explicatif                   | SQL + métier                                                      |
| Correction d’erreur                | Motif obligatoire, audit initial préservé        | SQL                                                               |
| Rotation                           | Ancien lien/QR invalidé, nouveau lien communiqué | SQL                                                               |
| Connexion perdue                   | Pas d’admission offline, réessai même UUID       | E2E état offline ; perte de réponse à vérifier manuellement       |

## Répétition pratique sur place

1. Utiliser au moins deux téléphones réels, un iPhone Safari et un Android Chrome si disponibles, avec comptes accueil distincts. Se connecter puis fermer/rouvrir le navigateur ; vérifier que l’accès persiste et que la déconnexion coupe l’accès API.
2. Tester avec Wi-Fi et réseaux de deux opérateurs, HTTPS et caméra autorisée. Scanner un QR affiché sur un autre téléphone et un QR imprimé, sous lumière réelle de la salle. Vérifier les boutons avec une main.
3. Créer invitations individuelle/couple/famille. Confirmer 3 sur 5 ; scanner sans valider pour montrer que le scan ne consomme pas de place. Faire entrer 2 puis 1 sur des appareils différents.
4. Présenter le même QR complet, un QR quelconque, une invitation annulée et une invitation sans RSVP. L’agent doit pouvoir expliquer chaque refus.
5. Répéter le test concurrent sur deux appareils : afficher 3 places restantes sur les deux, tenter 2 entrées chacun. Un seul doit réussir. L’autre actualise et voit 1 place.
6. Tester le script `scripts/test-supabase.mjs` avec deux comptes sur la base de recette. Vérifier le journal et le compteur via admin.
7. Supprimer le QR du téléphone invité ou annoncer une batterie vide ; rechercher le nom/code, vérifier le nom annoncé, admettre manuellement.
8. Couper le réseau avant d’enregistrer : entrée bloquée. Couper le réseau pendant l’enregistrement : réessayer l’opération existante et vérifier qu’elle n’est pas comptée deux fois. Si le téléphone s’éteint, faire vérifier le compteur/journal par le responsable avant toute nouvelle entrée.
9. Tester le téléchargement du QR et l’impression du pass complet. Sauvegarder le QR avant de venir ; consulter le lien requiert le réseau.
10. Importer le modèle CSV depuis Excel UTF-8, vérifier l’aperçu ; exporter et ouvrir dans Excel, contrôler accents/téléphones. Tester la ventilation et distinguer invitations et personnes.
11. Corriger une admission avec motif ; vérifier ancien événement et correction dans le journal. Annuler les invitations de test ; leurs admissions restent dans les totaux de présents, donc préférer une base de recette séparée.
12. Faire une sauvegarde privée de PostgreSQL et tester sa restauration sur une base séparée. Conserver mots de passe et accès à la console chez deux organisateurs désignés.

## Préparation finale

Vérifier capacité, quotas, réponses, invitations envoyées et numéros de téléphone avant le 16 octobre. Le 17 octobre : charger les appareils, préparer powerbanks, connexion secondaire et liste minimale papier. Désigner un responsable autorisé à régler les invitations sans réponse ou erreurs. En secours papier, un seul compteur manuel fait foi jusqu’à sa réconciliation ; les autres agents suspendent les admissions numériques.
