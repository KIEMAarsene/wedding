# Tester le parcours complet sur téléphone, sans déploiement

Le PC et les téléphones doivent rester sur le **même Wi-Fi privé**. Adresse détectée pendant cette session : **192.168.1.65**. Si l’adresse change, reprendre la génération du certificat pour la nouvelle IP. Le PC doit rester allumé et le serveur lancé. Aucun hébergement public et aucune ouverture automatique du pare-feu/routeur ne sont effectués.

## HTTPS et caméra

Le scanner caméra nécessite une connexion HTTPS reconnue par le téléphone. Le certificat local et sa CA de test sont créés dans `.phone-test/`, non versionnés et valides 7 jours. Aucune CA n’est installée automatiquement sur le PC ou un téléphone ; la clé privée de la CA n’est pas conservée. Le fichier à transférer est uniquement **`.phone-test/ca.cer`** ; ne jamais transférer `server.key`.

Le serveur HTTPS de test écoute sur **3443** :

```powershell
pnpm phone:test 192.168.1.65
```

Alternative sans pnpm : `node scripts/phone-test.mjs 192.168.1.65`. Il utilise `.next-phone` pour ne pas perturber la démo localhost sur 3000. `APP_URL` et la sélection des origines sont définies par ce script. Le mot de passe est celui de `.env.local`, actuellement `votre-mot-de-passe-local`.

La démo Wi-Fi utilise **`.demo-phone/data.json`**, distinct de `.demo/data.json`. Utiliser l’URL HTTPS **3443 pour tous les participants**, y compris l’admin sur le PC, afin de voir le même dashboard et les mêmes invitations. Cette séparation évite que deux serveurs locaux réécrivent le même fichier. Pour sauvegarder cette démo : `node scripts/export-demo.mjs .demo-phone/data.json`.

Certificats déjà générés dans ce workspace. Pour les regénérer ultérieurement : arrêter le serveur, archiver le dossier `.phone-test`, puis `python scripts/create-phone-cert.py ADRESSE-IP`. La bibliothèque Python `cryptography` est nécessaire ; elle est disponible dans le runtime Python livré ici. Ce script ne sert pas à produire des certificats publics.

### Installer le certificat sur le téléphone testeur

Transférer `.phone-test/ca.cer` via le câble ou un mécanisme privé de transfert de fichiers. On peut aussi ouvrir `https://192.168.1.65:3443/test-ca` pour télécharger ce certificat public en acceptant temporairement l’avertissement initial. Installer et **faire confiance** à cette CA avant de tester la caméra : passer outre un avertissement HTTPS ne remplace pas une chaîne de confiance valide.

- iPhone/iPad : ouvrir le certificat pour installer le profil depuis Réglages, puis activer la confiance de cette CA dans Général → Informations → Réglages des certificats. Les libellés peuvent varier selon la version d’iOS. [Instructions Apple](https://support.apple.com/en-ie/102390).
- Android : installer le certificat CA depuis les paramètres de sécurité/chiffrement et certificats, puis relancer Chrome. Le chemin dépend du constructeur et de la version. [Instructions Google](https://support.google.com/pixelphone/answer/2844832?hl=en).

Cette confiance concerne uniquement votre test local. Retirer le certificat/profil après les essais. Ne pas installer une CA reçue d’un tiers inconnu ; utiliser le fichier généré dans ce dossier. Si le téléphone est géré par une entreprise et interdit l’installation de CA, utiliser ultérieurement une preview HTTPS avec base de recette ou tester les admissions manuelles en attendant.

Si le site est inaccessible : vérifier le même Wi-Fi, l’adresse IPv4 du PC, le serveur en cours et l’absence d’isolation des clients Wi-Fi. Si Windows demande l’accès réseau, ne l’autoriser que sur le réseau privé de test. Ne pas ouvrir de port sur le routeur. Le firewall n’a pas été modifié par l’agent.

## URLs et connexion

- Accueil : **https://192.168.1.65:3443**
- Équipe : **https://192.168.1.65:3443/login**
- Tableau de bord : **https://192.168.1.65:3443/admin**
- Scan : **https://192.168.1.65:3443/accueil**

Adresse e-mail valide au choix et mot de passe **votre-mot-de-passe-local**. Rôle administrateur sur le PC ou téléphone de suivi, rôle accueil sur les téléphones des agents. Ces rôles choisis n’existent qu’en démo ; Supabase impose les rôles attribués en base.

## Invitation → RSVP → QR → scan → admission → dashboard

1. Ouvrir `/login` comme admin. Créer **Famille Test Téléphone**, quota **5**, catégorie **Recette**, commentaire **Fictif — test téléphone**. Ne pas consommer la première famille démo si vous souhaitez conserver son exemple.
2. Cliquer sur cette invitation, copier son **lien personnel HTTPS** et l’ouvrir sur le téléphone invité. Le programme complet est visible. Confirmer **3 personnes** ; vérifier « Présence confirmée : 3 personnes » et « Invitation : AG-XXXX ».
3. Enregistrer le QR. Sur un autre téléphone, se connecter en accueil, ouvrir le scanner et autoriser la caméra. Scanner le QR affiché sur le premier téléphone ou une impression. Avec un seul téléphone, afficher le QR sur le PC pour le scanner, ou utiliser la recherche manuelle.
4. Vérifier immédiatement : nom, code, 5 places autorisées, 3 confirmées, 0 déjà entrées, 3 restantes. Choisir **2** puis enregistrer. Résultat **2/3**, **1 restante**.
5. Sur le même téléphone ou un second agent, scanner à nouveau le même QR. Faire entrer **1** : **3/3**, invitation complète. Représenter le QR : aucune nouvelle entrée autorisée, message explicite.
6. Ouvrir le dashboard admin : le nombre de personnes présentes augmente de **3**, et le nombre restant diminue de **3**. Actualisation automatique dans les 15 secondes ou bouton Actualiser. Le nombre d’invitations reste inchangé pendant les admissions.
7. Pour tester la concurrence, créer une **nouvelle invitation** confirmée pour 3 personnes. La sélectionner sur deux téléphones avant d’admettre, avec 3 restantes affichées. Choisir 2 sur chaque téléphone et valider ensemble. Un seul enregistrement doit réussir ; l’autre affiche le manque de places et se met à jour avec 1 restante. Terminer avec 1.
8. Tester la batterie vide via recherche du nom/code, puis une invitation annulée et une sans réponse. Couper le réseau : aucune admission enregistrée hors ligne. Une opération dont la réponse est perdue se réessaie avec le même identifiant ; elle est reprise au rechargement du même onglet.
9. Annuler les invitations de test dans Admin ; ne jamais exporter/importer ces lignes dans le réel. Les entrées de test restent journalisées et comptées dans cette démo. Fermer le serveur avec Ctrl+C et retirer le certificat de test du téléphone.

Ce parcours vérifie le produit et la caméra sur des téléphones, mais la démo stocke les données sur le PC et sérialise les écritures. La garantie PostgreSQL multi-instance doit aussi être validée avec Supabase réel de recette, selon `PRE_DEPLOIEMENT.md`. Le serveur Wi-Fi local n’est pas un déploiement de production.
