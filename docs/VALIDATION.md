# Validation locale — 4 octobre 2026

- 29 tests métier/SQL : réussite. Migration PostgreSQL, RLS, rôles, quotas, admissions partielles, idempotence, import atomique et audit exécutés dans PGlite.
- 14 tests navigateur : réussite, Chrome ordinateur et Pixel 7 émulé. RSVP, QR, accueil manuel, requêtes concurrentes de démonstration, rôles, CSRF, offline, import, perte de réponse réseau avec reprise après rechargement et décodage du QR via un flux caméra simulé.
- TypeScript, ESLint et build Next.js : contrôles finaux réussis, aucune erreur ni avertissement lint.
- Serveur de production démarré et contrôlé : accueil HTTP 200, administration redirigée sans session, démo exclue malgré DEMO_MODE=true, CSP sans unsafe-eval. La démonstration locale a ensuite été relancée sur le port 3000.
- Captures de l’admin, de l’invitation et de l’accueil inspectées sur ordinateur et mobile. Aucun débordement horizontal de la page dans les assertions mobiles ; les tableaux utilisent leur propre défilement.

La concurrence de PostgreSQL distant et les connexions Auth réelles nécessitent le projet Supabase de recette. Le script à deux sessions est livré mais n’a pas été exécuté sans ces accès. La caméra réelle et le réseau de la salle restent à tester selon RECETTE.md. Aucun compte extérieur, aucun invité réel et aucun déploiement public n’ont été utilisés.

## Phase de finition

- 35 tests métier/SQL/interfaces production et 16 tests navigateur, tous réussis (51 tests). Deux sessions avec compteurs périmés, admission partielle de 2 puis 1 et contrôle du dashboard ; 30 demandes SQL pour 3 places ; corrections admin refusées si incohérentes.
- Réessais de démo contrôlés pour exclure les tokens/commentaires des retours agent. Perte de réponse et session expirée testées : l’identifiant en attente persiste et aucun doublon d’admission n’est créé.
- Programme complet et mentions explicites du pass vérifiés dans le navigateur, formats mobile et ordinateur ; défilement automatique vers la fiche après scan/sélection vérifié sur mobile.
- HTTPS Wi-Fi démarré sur `192.168.1.65:3443`, chaîne TLS vérifiée avec la CA locale, accès à l’invitation et téléchargement du certificat public contrôlés. Aucune installation automatique de certificat ni changement de pare-feu.
- Sauvegarde locale JSON et CSV d’import/consultation créée dans `.private-backups/` ; fichier de démonstration original conservé. Scripts de sauvegarde et de recette Supabase vérifiés syntaxiquement.
- Dossier `PRE_DEPLOIEMENT.md` et guide `TEST_TELEPHONE.md` livrés. Le test Supabase utilise maintenant un admin et deux comptes accueil distincts, et reste à exécuter avec les accès du projet de recette.
- Build final et TypeScript/lint réussis sans avertissement. Build de production contrôlé dans Chrome sur accueil/login/redirections Admin/Accueil : aucune mention/bouton/choix de rôle démo ; `/test-ca` 404, CSP sans unsafe-eval.
- Parcours Wi-Fi HTTPS vérifié avec une invitation fictive dédiée : connexion admin, cookie Secure, création quota 5, programme, RSVP 3, QR, admission 2 puis 1, dashboard à 3 et annulation de l’invitation de test. Le navigateur automatisé a ignoré l’avertissement TLS pour ce parcours ; la chaîne a été vérifiée séparément avec la CA, qui devra être approuvée manuellement sur les téléphones réels. Le test n’a installé aucun certificat sur le système.
