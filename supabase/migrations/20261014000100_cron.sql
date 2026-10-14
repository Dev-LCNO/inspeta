-- Agendador: a cada minuto o pg_cron chama a função "jobs" (fila de e-mails e agenda) via pg_net.
-- O segredo do agendador nasce aqui, aleatório, em interno.config (fora da API pública); ninguém digita nem copia.
-- url_jobs, app_url e origens são gravados depois da publicação (não são segredo).
create schema if not exists interno;
revoke all on schema interno from public;
create table if not exists interno.config (nome text primary key, valor text not null);
insert into interno.config (nome, valor)
values ('cron_secret', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (nome) do nothing;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema interno from anon, authenticated';
    execute 'revoke all on all tables in schema interno from anon, authenticated';
  end if;
  -- no Postgres local (testes) as extensões não existem: o agendamento só é criado no Supabase
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron with schema pg_catalog;
    create extension if not exists pg_net with schema extensions;
    perform cron.schedule('inspeta-jobs', '* * * * *', $job$
      select net.http_post(
        url := c.url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', c.segredo),
        body := '{}'::jsonb,
        timeout_milliseconds := 55000)
      from (select (select valor from interno.config where nome = 'url_jobs') as url,
                   (select valor from interno.config where nome = 'cron_secret') as segredo) c
      where c.url is not null and c.segredo is not null
    $job$);
    -- respostas do pg_net acumulam; mantém só um dia
    perform cron.schedule('inspeta-limpa-net', '17 3 * * *', $job$ delete from net._http_response where created < now() - interval '1 day' $job$);
  end if;
end $$;
