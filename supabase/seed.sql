-- OPTIONNEL : données fictives uniquement, après la migration, dans un projet de test.
insert into public.invitations(name,phone,category,quota,status,confirmed,active,comment) values
('Awa TRAORÉ','','Amis',1,'pending',0,true,'Fictif : individuelle'),
('Paul & Marie KABORÉ','','Famille mariée',2,'confirmed',2,true,'Fictif : couple'),
('Famille OUEDRAOGO','','Famille marié',5,'confirmed',3,true,'Fictif : famille, réponse inférieure au quota'),
('Équipe CILSS','','Collègues CILSS',4,'declined',0,true,'Fictif : refus'),
('Invitation annulée','','Connaissances',2,'confirmed',2,false,'Fictif : annulation');
-- Retrouver les liens dans l’interface admin. Aucun token fixe en production.
