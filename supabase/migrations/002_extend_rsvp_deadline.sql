-- Prolongation RSVP au 17 octobre 2026 à 20h UTC (Ouagadougou).
-- Aucun changement de données, quotas, jetons ou privilèges.
begin;
create or replace function public.guest_rsvp(p_token text,p_status text,p_count integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.invitations;
begin
  select * into i from public.invitations where invite_token=p_token for update;
  if not found then raise exception 'Lien inconnu. Vérifiez votre invitation.'; end if;
  if not i.active then raise exception 'Cette invitation a été annulée. Contactez les mariés.'; end if;
  if i.admitted>0 then raise exception 'La réponse est verrouillée après une première entrée.'; end if;
  if now()>='2026-10-17 20:00:00+00'::timestamptz then raise exception 'Les réponses sont closes. Contactez les mariés.'; end if;
  if p_status is null or p_count is null or p_status not in ('confirmed','declined') or (p_status='confirmed' and (p_count<1 or p_count>i.quota)) or (p_status='declined' and p_count<>0) then
    raise exception 'Le nombre demandé dépasse les places autorisées ou est invalide.';
  end if;
  update public.invitations set status=p_status, confirmed=p_count where id=i.id;
  insert into public.audit_log(invitation_id,action,details) values(i.id,'rsvp',jsonb_build_object('status',p_status,'count',p_count));
  return public.guest_invitation(p_token);
end; $$;
commit;
