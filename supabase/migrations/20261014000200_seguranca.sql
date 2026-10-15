-- Segurança em camadas (pode rodar mais de uma vez).
--
-- 1) Segunda barreira: a API não lê nem grava como "postgres" (que passa por cima do RLS).
--    Em cada transação ela troca para o papel inspeta_api e declara a organização da pessoa logada
--    (set_config('inspeta.org_id', ...)). As políticas abaixo só deixam ver e gravar linhas dessa
--    organização — se o código da API errar, o banco não entrega dados de outra empresa.
-- 2) Limite de pedidos: contador por janela de tempo (interno.consumir), usado pela API.
-- 3) Senha errada: hook do Supabase Auth que bloqueia a conta por 15 min depois de 5 erros seguidos.

-- ---------- 1) papel restrito + RLS por organização ----------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'inspeta_api') then
    create role inspeta_api nologin nobypassrls;
  end if;
end $$;
grant inspeta_api to current_user;   -- quem conecta (postgres) pode assumir o papel com SET ROLE

create schema if not exists interno;
create or replace function interno.org_atual() returns uuid
  language sql stable set search_path = '' as
$$ select nullif(current_setting('inspeta.org_id', true), '')::uuid $$;

grant usage on schema public to inspeta_api;
grant usage on schema interno to inspeta_api;
revoke all on all tables in schema interno from inspeta_api;
grant execute on function interno.org_atual() to inspeta_api;
grant select, insert, update, delete on registros, anexos to inspeta_api;
grant select on orgs to inspeta_api;
grant update (contadores) on orgs to inspeta_api;
grant insert on auditoria to inspeta_api;

drop policy if exists api_mesma_org on registros;
create policy api_mesma_org on registros for all to inspeta_api
  using (org_id = (select interno.org_atual())) with check (org_id = (select interno.org_atual()));
drop policy if exists api_mesma_org on anexos;
create policy api_mesma_org on anexos for all to inspeta_api
  using (org_id = (select interno.org_atual())) with check (org_id = (select interno.org_atual()));
drop policy if exists api_mesma_org_ler on orgs;
create policy api_mesma_org_ler on orgs for select to inspeta_api using (id = (select interno.org_atual()));
drop policy if exists api_mesma_org_contador on orgs;
create policy api_mesma_org_contador on orgs for update to inspeta_api
  using (id = (select interno.org_atual())) with check (id = (select interno.org_atual()));
drop policy if exists api_mesma_org on auditoria;
create policy api_mesma_org on auditoria for insert to inspeta_api with check (org_id = (select interno.org_atual()));

-- ---------- 2) limite de pedidos ----------
create table if not exists interno.limites (
  chave text not null,
  janela bigint not null,
  n int not null default 0,
  criado timestamptz not null default now(),
  primary key (chave, janela)
);
create index if not exists limites_criado on interno.limites (criado);

-- soma 1 na janela atual e diz se ainda está dentro do limite
create or replace function interno.consumir(p_chave text, p_limite int, p_janela_s int) returns boolean
  language sql volatile set search_path = '' as
$$
  insert into interno.limites as l (chave, janela, n)
  values (p_chave, floor(extract(epoch from now()) / p_janela_s)::bigint, 1)
  on conflict (chave, janela) do update set n = l.n + 1
  returning l.n <= p_limite
$$;
-- só lê (para checar falhas antes de gastar uma chamada ao Auth)
create or replace function interno.contagem(p_chave text, p_janela_s int) returns int
  language sql stable set search_path = '' as
$$
  select coalesce((select n from interno.limites
                   where chave = p_chave and janela = floor(extract(epoch from now()) / p_janela_s)::bigint), 0)
$$;
revoke all on function interno.consumir(text, int, int) from public;
revoke all on function interno.contagem(text, int) from public;

-- ---------- 3) bloqueio por senha errada (Password Verification Hook) ----------
create table if not exists interno.tentativas_senha (
  user_id uuid primary key,
  falhas int not null default 0,
  primeira_falha timestamptz,
  bloqueado_ate timestamptz
);

create or replace function public.inspeta_hook_senha(event jsonb) returns jsonb
  language plpgsql set search_path = '' as
$$
declare
  u uuid := (event->>'user_id')::uuid;
  t interno.tentativas_senha;
begin
  select * into t from interno.tentativas_senha where user_id = u;
  if t.bloqueado_ate is not null and t.bloqueado_ate > now() then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 429,
      'message', 'Muitas tentativas de senha. Espere 15 minutos e tente de novo.'));
  end if;
  if coalesce((event->>'valid')::boolean, false) then
    delete from interno.tentativas_senha where user_id = u;
    return jsonb_build_object('decision', 'continue');
  end if;
  insert into interno.tentativas_senha as x (user_id, falhas, primeira_falha) values (u, 1, now())
  on conflict (user_id) do update set
    falhas = case when x.primeira_falha is null or x.primeira_falha < now() - interval '15 minutes' then 1 else x.falhas + 1 end,
    primeira_falha = case when x.primeira_falha is null or x.primeira_falha < now() - interval '15 minutes' then now() else x.primeira_falha end,
    bloqueado_ate = null
  returning * into t;
  if t.falhas >= 5 then
    update interno.tentativas_senha set bloqueado_ate = now() + interval '15 minutes', falhas = 0, primeira_falha = null
    where user_id = u;
  end if;
  return jsonb_build_object('decision', 'continue');
end
$$;
revoke all on function public.inspeta_hook_senha(jsonb) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.inspeta_hook_senha(jsonb) from anon, authenticated';
    execute 'revoke all on schema interno from anon, authenticated';
    execute 'revoke all on all tables in schema interno from anon, authenticated';
    execute 'revoke all on function interno.consumir(text, int, int) from anon, authenticated';
    execute 'revoke all on function interno.contagem(text, int) from anon, authenticated';
    execute 'revoke all on function interno.org_atual() from anon, authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    execute 'grant usage on schema interno to supabase_auth_admin';
    execute 'grant select, insert, update, delete on interno.tentativas_senha to supabase_auth_admin';
    execute 'grant execute on function public.inspeta_hook_senha(jsonb) to supabase_auth_admin';
  end if;
end $$;
