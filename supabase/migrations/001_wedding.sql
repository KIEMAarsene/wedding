-- Exécuter une fois dans le SQL editor Supabase, ou supabase db push.
create table public.staff_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','accueil'))
);
create sequence public.invitation_code_seq;
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('AG-' || lpad(nextval('public.invitation_code_seq')::text,4,'0')),
  name text not null check(length(name) between 2 and 160),
  phone text not null default '' check(length(phone)<=30),
  category text not null check(length(category) between 1 and 80),
  comment text not null default '' check(length(comment)<=1000),
  quota integer not null check(quota between 1 and 300),
  confirmed integer not null default 0,
  admitted integer not null default 0,
  status text not null default 'pending' check(status in ('pending','confirmed','declined')),
  active boolean not null default true,
  sent_at timestamptz,
  invite_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text,'-',''),
  pass_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text,'-',''),
  created_at timestamptz not null default now(),
  check(confirmed between 0 and quota), check(admitted between 0 and confirmed),
  check((status='confirmed' and confirmed>=1) or (status<>'confirmed' and confirmed=0))
);
create table public.admissions (
  request_id uuid primary key,
  invitation_id uuid not null references public.invitations(id),
  actor_id uuid not null references auth.users(id),
  count integer not null check(count>0),
  created_at timestamptz not null default now()
);
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid references public.invitations(id),
  actor_id uuid references auth.users(id),
  action text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table public.rate_limits (key text not null, window_start timestamptz not null, count integer not null, primary key(key,window_start));
create index invitations_name_idx on public.invitations(lower(name));
create index audit_date_idx on public.audit_log(created_at desc);
alter table public.staff_roles enable row level security;
alter table public.invitations enable row level security;
alter table public.admissions enable row level security;
alter table public.audit_log enable row level security;
alter table public.rate_limits enable row level security;

create function public.staff_role() returns text language sql stable security definer set search_path='' as $$
  select role from public.staff_roles where user_id=auth.uid();
$$;
create policy role_read_self on public.staff_roles for select to authenticated using(user_id=auth.uid());
create policy invitation_admin_read on public.invitations for select to authenticated using(public.staff_role()='admin');
create policy audit_admin_read on public.audit_log for select to authenticated using(public.staff_role()='admin');
create policy admissions_admin_read on public.admissions for select to authenticated using(public.staff_role()='admin');
-- Aucun INSERT/UPDATE/DELETE direct pour les utilisateurs, même administrateurs.
revoke all on public.staff_roles, public.invitations, public.admissions, public.audit_log, public.rate_limits from anon, authenticated;
grant select on public.staff_roles,public.invitations,public.audit_log,public.admissions to authenticated;
grant all on public.staff_roles,public.invitations,public.audit_log,public.admissions,public.rate_limits to service_role;
grant usage,select on public.invitation_code_seq to service_role;

create function public.require_staff(p_admin boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or public.staff_role() is null or (p_admin and public.staff_role()<>'admin') then
    raise exception 'Accès refusé. Connectez-vous avec un compte autorisé.' using errcode='42501';
  end if;
end; $$;

create function public.guest_invitation(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.invitations;
begin
  select * into i from public.invitations where invite_token=p_token;
  if not found then raise exception 'Lien inconnu. Vérifiez votre invitation.'; end if;
  return jsonb_build_object('code',i.code,'name',i.name,'quota',i.quota,'confirmed',i.confirmed,'admitted',i.admitted,'status',i.status,'active',i.active,'pass_token',case when i.active and i.status='confirmed' then i.pass_token else null end);
end; $$;

create function public.guest_rsvp(p_token text,p_status text,p_count integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.invitations;
begin
  select * into i from public.invitations where invite_token=p_token for update;
  if not found then raise exception 'Lien inconnu. Vérifiez votre invitation.'; end if;
  if not i.active then raise exception 'Cette invitation a été annulée. Contactez les mariés.'; end if;
  if i.admitted>0 then raise exception 'La réponse est verrouillée après une première entrée.'; end if;
  if now()>='2026-10-16 18:00:00+00'::timestamptz then raise exception 'Les réponses sont closes. Contactez les mariés.'; end if;
  if p_status is null or p_count is null or p_status not in ('confirmed','declined') or (p_status='confirmed' and (p_count<1 or p_count>i.quota)) or (p_status='declined' and p_count<>0) then
    raise exception 'Le nombre demandé dépasse les places autorisées ou est invalide.';
  end if;
  update public.invitations set status=p_status, confirmed=p_count where id=i.id;
  insert into public.audit_log(invitation_id,action,details) values(i.id,'rsvp',jsonb_build_object('status',p_status,'count',p_count));
  return public.guest_invitation(p_token);
end; $$;

create function public.staff_search(p_query text default '') returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform public.require_staff();
  return coalesce((select jsonb_agg(to_jsonb(x)) from (
    select id,code,name,phone,category,quota,confirmed,admitted,status,active,sent_at,created_at
    from public.invitations where length(p_query)<=160 and (p_query='' or name ilike '%'||p_query||'%' or code ilike '%'||p_query||'%' or (length(p_query)>=4 and phone ilike '%'||p_query||'%'))
    order by name limit 500
  ) x),'[]'::jsonb);
end; $$;
create function public.staff_scan(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.invitations;
begin
  perform public.require_staff();
  select * into i from public.invitations where pass_token=p_token;
  if not found then raise exception 'QR inconnu. Utilisez la recherche par nom ou code.'; end if;
  return to_jsonb(i)-'invite_token'-'pass_token'-'comment';
end; $$;

create function public.admit(p_id uuid,p_count integer,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.invitations; prior public.admissions;
begin
  perform public.require_staff();
  if p_request_id is null or p_id is null or p_count is null or p_count<1 then raise exception 'Admission invalide.'; end if;
  -- Sérialise aussi les réessais de la même requête, même si invitation différente.
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into prior from public.admissions where request_id=p_request_id;
  if found then
    if prior.invitation_id<>p_id or prior.count<>p_count or prior.actor_id<>auth.uid() then raise exception 'Identifiant de requête déjà utilisé.'; end if;
    select * into i from public.invitations where id=p_id;
    return (to_jsonb(i)-'invite_token'-'pass_token'-'comment') || jsonb_build_object('replayed',true);
  end if;
  select * into i from public.invitations where id=p_id for update;
  if not found then raise exception 'Invitation introuvable.'; end if;
  if not i.active then raise exception 'Invitation annulée. Aucune entrée autorisée.'; end if;
  if i.status<>'confirmed' then raise exception 'Présence non confirmée. Demandez à un administrateur.'; end if;
  if i.admitted>=i.confirmed then raise exception 'Invitation déjà entièrement utilisée.'; end if;
  if p_count>i.confirmed-i.admitted then raise exception 'Places restantes insuffisantes. Actualisez cette invitation.'; end if;
  update public.invitations set admitted=admitted+p_count where id=p_id returning * into i;
  insert into public.admissions(request_id,invitation_id,actor_id,count) values(p_request_id,p_id,auth.uid(),p_count);
  insert into public.audit_log(invitation_id,actor_id,action,details) values(p_id,auth.uid(),'admission',jsonb_build_object('count',p_count,'request_id',p_request_id));
  return to_jsonb(i)-'invite_token'-'pass_token'-'comment';
end; $$;

create function public.admin_save(p_data jsonb,p_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.invitations; old public.invitations;
begin
  perform public.require_staff(true);
  if p_data->>'name' is null or p_data->>'category' is null or p_data->>'quota' is null then raise exception 'Champs obligatoires manquants.'; end if;
  if p_id is null then
    insert into public.invitations(name,phone,category,quota,comment) values(trim(p_data->>'name'),coalesce(p_data->>'phone',''),trim(p_data->>'category'),(p_data->>'quota')::integer,coalesce(p_data->>'comment','')) returning * into i;
  else
    select * into old from public.invitations where id=p_id for update;
    if not found then raise exception 'Invitation introuvable.'; end if;
    if (p_data->>'quota')::integer<old.confirmed then raise exception 'Le quota ne peut pas être inférieur au nombre confirmé.'; end if;
    update public.invitations set name=trim(p_data->>'name'),phone=coalesce(p_data->>'phone',''),category=trim(p_data->>'category'),quota=(p_data->>'quota')::integer,comment=coalesce(p_data->>'comment','') where id=p_id returning * into i;
  end if;
  insert into public.audit_log(invitation_id,actor_id,action,details) values(i.id,auth.uid(),case when p_id is null then 'create' else 'edit' end,jsonb_build_object('quota',i.quota,'previous_quota',old.quota));
  return to_jsonb(i);
end; $$;
create function public.admin_action(p_id uuid,p_action text,p_value jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.invitations; before_count integer;
begin
  perform public.require_staff(true);
  select * into i from public.invitations where id=p_id for update;
  if not found then raise exception 'Invitation introuvable.'; end if;
  before_count:=i.admitted;
  if p_action='active' then
    if jsonb_typeof(p_value->'active')<>'boolean' or p_value->'active' is null then raise exception 'Activation invalide.'; end if;
    update public.invitations set active=(p_value->>'active')::boolean where id=p_id;
  elsif p_action='sent' then update public.invitations set sent_at=now() where id=p_id;
  elsif p_action='rotate' then update public.invitations set invite_token=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),pass_token=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','') where id=p_id;
  elsif p_action='correct' then
    if coalesce(length(trim(p_value->>'reason')),0)<5 or p_value->>'count' is null or (p_value->>'count')::integer<0 or (p_value->>'count')::integer>i.confirmed then raise exception 'Correction invalide : motif et nombre compris entre 0 et confirmé requis.'; end if;
    update public.invitations set admitted=(p_value->>'count')::integer where id=p_id;
  elsif p_action='rsvp' then
    if p_value->>'status' is null or p_value->>'count' is null or coalesce(length(trim(p_value->>'reason')),0)<5 then raise exception 'Réponse et motif obligatoires.'; end if;
    update public.invitations set status=p_value->>'status',confirmed=(p_value->>'count')::integer where id=p_id;
  else raise exception 'Action inconnue.'; end if;
  insert into public.audit_log(invitation_id,actor_id,action,details) values(p_id,auth.uid(),p_action,p_value||jsonb_build_object('previous_admitted',before_count));
  select * into i from public.invitations where id=p_id;
  return to_jsonb(i);
end; $$;
create function public.admin_import(p_rows jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare row jsonb; n integer:=0;
begin
  perform public.require_staff(true);
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>500 or jsonb_array_length(p_rows)<1 then raise exception 'Import : 1 à 500 lignes requises.'; end if;
  for row in select value from jsonb_array_elements(p_rows) loop
    perform public.admin_save(row); n:=n+1;
  end loop;
  return n;
end; $$;
create function public.consume_rate_limit(p_key text) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
  delete from public.rate_limits where window_start<now()-interval '2 minutes';
  insert into public.rate_limits(key,window_start,count) values(p_key,date_trunc('minute',now()),1)
  on conflict(key,window_start) do update set count=public.rate_limits.count+1 returning count into n;
  return n<=60;
end; $$;

-- Par défaut PostgreSQL accorde EXECUTE à PUBLIC : révoquer explicitement.
revoke execute on function public.staff_role(),public.require_staff(boolean),public.guest_invitation(text),public.guest_rsvp(text,text,integer),public.staff_search(text),public.staff_scan(text),public.admit(uuid,integer,uuid),public.admin_save(jsonb,uuid),public.admin_action(uuid,text,jsonb),public.admin_import(jsonb),public.consume_rate_limit(text) from public, anon, authenticated;
grant execute on function public.staff_role(),public.require_staff(boolean),public.staff_search(text),public.staff_scan(text),public.admit(uuid,integer,uuid),public.admin_save(jsonb,uuid),public.admin_action(uuid,text,jsonb),public.admin_import(jsonb) to authenticated;
grant execute on function public.guest_invitation(text),public.guest_rsvp(text,text,integer),public.consume_rate_limit(text) to service_role;
