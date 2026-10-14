-- =====================================================================
-- Schema v1 — clone do CLICQ (inspeções de qualidade, offline-first)
-- Alvo: Postgres 15+ no Supabase (auth.users, auth.uid(), Storage).
-- Acesso: Row Level Security em TODAS as tabelas. O backend usa a
-- service role só para: link público de plano de ação, jobs e webhooks.
-- Convenções: uuid PK, timestamptz em UTC, org_id em tudo que é da
-- organização, FKs com on delete decidido, índice em toda FK e filtro.
-- =====================================================================

create extension if not exists pgcrypto;
create schema if not exists app;

-- ---------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------
create or replace function app.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- =====================================================================
-- 1. ORGANIZAÇÃO, MEMBROS, FUNÇÕES, EQUIPES, PERMISSÕES
-- =====================================================================

create table organizacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  logo_path text,
  fuso_horario text not null default 'America/Sao_Paulo',
  plano text not null default 'trial'
    check (plano in ('trial','essencial','profissional','enterprise')),
  assinatura_status text not null default 'trialing'
    check (assinatura_status in ('trialing','active','past_due','canceled')),
  stripe_customer_id text unique,
  limite_aplicadores int not null default 3 check (limite_aplicadores > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cargo com a lista de ações permitidas (S31 "Funções")
create table funcoes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  nome text not null,
  acoes text[] not null default '{}',
  -- valores válidos de acoes (checados na aplicação + check abaixo):
  constraint acoes_validas check (acoes <@ array[
    'gerenciar_formularios','aplicar','editar_inspecao','excluir_inspecao',
    'ver_todas_inspecoes','gerenciar_avaliados','gerenciar_planos',
    'gerenciar_agendamentos','gerenciar_workflows','gerenciar_permissoes',
    'aprovar','ver_painel'
  ]::text[]),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, nome)
);
create index on funcoes (org_id);

create table membros (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  is_master boolean not null default false,       -- dono da conta: tudo liberado
  funcao_id uuid references funcoes(id) on delete set null,
  unidade_logistica text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index on membros (user_id);
create index on membros (funcao_id);

create table equipes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, nome)
);

create table equipe_membros (
  equipe_id uuid not null references equipes(id) on delete cascade,
  membro_id uuid not null references membros(id) on delete cascade,
  primary key (equipe_id, membro_id)
);
create index on equipe_membros (membro_id);

-- Permissões de ESCOPO (o QUE a pessoa vê/aplica). A FUNÇÃO diz o que ela FAZ.
create table permissoes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  sujeito_tipo text not null check (sujeito_tipo in ('membro','equipe')),
  sujeito_id uuid not null,                 -- membros.id ou equipes.id
  tipo text not null check (tipo in ('formulario','avaliado','ver_inspecoes_de_membro','ver_inspecoes_de_equipe')),
  alvo_id uuid not null,                    -- formularios.id | avaliados.id | membros.id | equipes.id
  recebe_email boolean not null default false,
  created_at timestamptz not null default now(),
  unique (sujeito_tipo, sujeito_id, tipo, alvo_id)
);
create index on permissoes (org_id, tipo, alvo_id);
create index on permissoes (sujeito_tipo, sujeito_id);

-- =====================================================================
-- 2. AVALIADOS (lojas, fornecedores, setores, CDs…)
-- =====================================================================

create table campos_avaliado (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  chave text not null check (chave ~ '^[a-z0-9_]+$'),
  rotulo text not null,
  tipo text not null default 'texto' check (tipo in ('texto','numero','data','opcao')),
  opcoes text[],
  obrigatorio boolean not null default false,
  visivel_na_lista boolean not null default true,
  depende_de_campo_id uuid references campos_avaliado(id) on delete set null,
  depende_de_valor text,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, chave)
);

create table avaliados (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  codigo_externo text,                      -- código do ERP / loja, p/ importação idempotente
  documento text,                           -- CNPJ/CPF
  email text,
  telefone text,
  endereco text,
  campos jsonb not null default '{}',       -- valores de campos_avaliado (chave -> valor)
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on avaliados (org_id, nome);
create unique index avaliados_codigo_unico on avaliados (org_id, codigo_externo) where codigo_externo is not null;

-- =====================================================================
-- 3. FORMULÁRIOS
-- Decisão: a definição (tópicos, questões, opções, notas, regras) é um
-- DOCUMENTO JSON validado por zod no app. O rascunho é editável; ao
-- publicar vira uma VERSÃO IMUTÁVEL. Inspeção aponta para a versão.
-- Motivo: o app offline baixa 1 JSON por formulário, o motor de nota roda
-- igual no celular e no servidor, e uma edição nunca altera inspeções
-- antigas. Cada questão/opção tem "key" uuid estável entre versões
-- (respostas e reincidência usam essa key).
-- =====================================================================

create table formularios (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  modulo text not null default 'processos' check (modulo in ('processos','produto')),
  nome text not null check (length(trim(nome)) > 0),
  rascunho jsonb not null default '{"topicos":[],"config":{}}',
  versao_publicada_id uuid,                 -- FK adicionada após formulario_versoes
  is_modelo boolean not null default false, -- modelo de questionário para copiar
  arquivado boolean not null default false,
  criado_por uuid references membros(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on formularios (org_id, arquivado, nome);

create table formulario_versoes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  formulario_id uuid not null references formularios(id) on delete cascade,
  numero int not null check (numero > 0),
  definicao jsonb not null,                 -- snapshot completo, nunca alterado
  publicado_por uuid references membros(id) on delete set null,
  publicado_em timestamptz not null default now(),
  unique (formulario_id, numero)
);
create index on formulario_versoes (org_id);

alter table formularios
  add constraint formularios_versao_fk
  foreign key (versao_publicada_id) references formulario_versoes(id) on delete set null;
create index on formularios (versao_publicada_id);

-- versão publicada é imutável
create or replace function app.bloquear_update_versao() returns trigger
language plpgsql as $$
begin
  raise exception 'formulario_versoes é imutável; publique uma nova versão';
end $$;
create trigger formulario_versoes_imutavel before update on formulario_versoes
  for each row execute function app.bloquear_update_versao();

-- Se a lista estiver vazia, o formulário vale para todos os avaliados (decisão do clone).
create table formulario_avaliados (
  formulario_id uuid not null references formularios(id) on delete cascade,
  avaliado_id uuid not null references avaliados(id) on delete cascade,
  primary key (formulario_id, avaliado_id)
);
create index on formulario_avaliados (avaliado_id);

create table questoes_preconfig (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  key uuid not null default gen_random_uuid(),  -- mesma key usada nos formulários
  titulo text not null,
  definicao jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, key)
);

-- =====================================================================
-- 4. INSPEÇÕES (aplicações)
-- =====================================================================

create table inspecoes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  client_uuid uuid not null,                -- gerado no aparelho: idempotência do sync offline
  formulario_id uuid not null references formularios(id) on delete restrict,
  formulario_versao_id uuid not null references formulario_versoes(id) on delete restrict,
  avaliado_id uuid not null references avaliados(id) on delete restrict,
  responsavel_id uuid not null references membros(id) on delete restrict,
  ocorrencia_id uuid,                       -- FK após ocorrencias
  workflow_etapa_id uuid,                   -- FK após workflow_etapas
  status text not null default 'rascunho'
    check (status in ('rascunho','completa','em_aprovacao','aprovada','reprovada')),
  iniciada_em timestamptz not null,
  finalizada_em timestamptz,
  geo_inicio point,                         -- (lng, lat)
  geo_fim point,
  nota_pontos numeric(10,2),
  nota_maxima numeric(10,2),
  nota_pct numeric(5,2) check (nota_pct between 0 and 100),
  classificacao text,                       -- nome da faixa (snapshot)
  classificacao_cor text,
  qtd_nao_conformidades int not null default 0,
  device_id text,
  app_versao text,
  relatorio_path text,                      -- PDF gerado no Storage
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, client_uuid),
  constraint finalizada_tem_data check (status = 'rascunho' or finalizada_em is not null),
  constraint fim_depois_inicio check (finalizada_em is null or finalizada_em >= iniciada_em)
);
create index on inspecoes (org_id, finalizada_em desc);
create index on inspecoes (org_id, status);
create index on inspecoes (formulario_id);
create index on inspecoes (formulario_versao_id);
create index on inspecoes (avaliado_id, formulario_id, finalizada_em desc);  -- reincidência / preenchimento automático
create index on inspecoes (responsavel_id);

create table respostas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  inspecao_id uuid not null references inspecoes(id) on delete cascade,
  questao_key uuid not null,                -- key estável da questão na definição
  amostra_idx int not null default 0,       -- amostragem sequencial (v2); 0 = única
  valor jsonb,                              -- {"opcoes":[key…]} | {"numero":x} | {"texto":"…"} | {"data":"…"} | {"na":true}
  observacao text,
  pontos numeric(10,2),
  pontos_max numeric(10,2),
  conforme boolean,                         -- null = sem regra de conformidade
  reincidente boolean not null default false,
  respondida_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (inspecao_id, questao_key, amostra_idx)   -- upsert do sync
);
create index on respostas (org_id, questao_key, conforme);
create index on respostas (inspecao_id) where conforme = false;

create table anexos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  inspecao_id uuid not null references inspecoes(id) on delete cascade,
  questao_key uuid,                         -- null = anexo da inspeção
  client_uuid uuid not null,
  tipo text not null check (tipo in ('foto','documento','assinatura')),
  storage_path text not null,               -- org/{org_id}/inspecoes/{inspecao_id}/{client_uuid}.{ext}
  mime text not null,
  bytes int not null check (bytes > 0 and bytes <= 15 * 1024 * 1024),
  enviado boolean not null default false,   -- true quando o upload do arquivo terminou
  created_at timestamptz not null default now(),
  unique (org_id, client_uuid)
);
create index on anexos (inspecao_id);

-- Log de auditoria (export Excel na S12) — append-only
create table inspecao_eventos (
  id bigint generated always as identity primary key,
  org_id uuid not null references organizacoes(id) on delete cascade,
  inspecao_id uuid not null references inspecoes(id) on delete cascade,
  membro_id uuid references membros(id) on delete set null,
  acao text not null check (acao in ('criada','sincronizada','finalizada','editada','reaberta','aprovada','reprovada','relatorio_enviado','excluida')),
  dados jsonb not null default '{}',
  em timestamptz not null default now()
);
create index on inspecao_eventos (inspecao_id, em);

-- =====================================================================
-- 5. AGENDAMENTOS (gestão de tarefas)
-- Regra: o job materializa ocorrências com até 14 dias de antecedência;
-- editar/inativar afeta só ocorrências 'pendente' futuras.
-- =====================================================================

create table agendamentos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  formulario_id uuid not null references formularios(id) on delete cascade,
  avaliado_id uuid not null references avaliados(id) on delete cascade,
  responsaveis uuid[] not null check (cardinality(responsaveis) > 0),   -- membros.id
  data_inicio date not null,
  horarios time[] not null default '{}',    -- vazio + dia_inteiro = notifica 08:00
  dia_inteiro boolean not null default false,
  fuso_horario text not null,               -- copiado da org no momento da criação
  recorrencia text not null default 'nenhuma'
    check (recorrencia in ('nenhuma','diaria','semanal','mensal')),
  dias_semana smallint[],                   -- 0=dom … 6=sáb (semanal)
  termino text not null default 'nunca' check (termino in ('nunca','data','quantidade')),
  termino_data date,
  termino_qtd int check (termino_qtd > 0),
  ativo boolean not null default true,
  materializado_ate date,
  criado_por uuid references membros(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint horario_ou_dia_inteiro check (dia_inteiro or cardinality(horarios) > 0),
  constraint termino_coerente check (
    (termino = 'nunca') or
    (termino = 'data' and termino_data is not null) or
    (termino = 'quantidade' and termino_qtd is not null))
);
create index on agendamentos (org_id, ativo);
create index on agendamentos (formulario_id);
create index on agendamentos (avaliado_id);

create table ocorrencias (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  agendamento_id uuid not null references agendamentos(id) on delete cascade,
  previsto_em timestamptz not null,
  status text not null default 'pendente'
    check (status in ('pendente','completa','atrasada','inativa')),
  justificativa text,
  inativada_por uuid references membros(id) on delete set null,
  notificado_em timestamptz,
  inspecao_id uuid references inspecoes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agendamento_id, previsto_em),     -- job pode rodar 2x sem duplicar
  constraint inativa_tem_justificativa check (status <> 'inativa' or justificativa is not null)
);
create index on ocorrencias (org_id, previsto_em);
create index on ocorrencias (status, previsto_em) where status = 'pendente';
create index on ocorrencias (inspecao_id);

alter table inspecoes
  add constraint inspecoes_ocorrencia_fk
  foreign key (ocorrencia_id) references ocorrencias(id) on delete set null;
create index on inspecoes (ocorrencia_id);

-- =====================================================================
-- 6. PLANOS DE AÇÃO
-- =====================================================================

create table planos_modelo (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  nome text not null,
  definicao jsonb not null default '{"topicos":[]}',   -- mesmo formato de formulário
  agrupamento text not null default 'por_inspecao' check (agrupamento in ('por_inspecao','por_nc')),
  prazo_dias int not null default 7 check (prazo_dias > 0),
  aprovacao jsonb,                                    -- {"etapas":[{"aprovadores":[membro_id…]}]}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, nome)
);

create table planos_acao (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  modelo_id uuid not null references planos_modelo(id) on delete restrict,
  modelo_snapshot jsonb not null,           -- definição congelada no disparo
  inspecao_id uuid not null references inspecoes(id) on delete cascade,
  questao_keys uuid[] not null,             -- NCs que originaram o plano
  responsavel_email text not null,
  responsavel_membro_id uuid references membros(id) on delete set null,
  token_hash text not null unique,          -- sha256 do token do link público; o token cru só vai no e-mail
  prazo date not null,
  status text not null default 'aberto'
    check (status in ('aberto','em_aprovacao','finalizado','reprovado')),
  respostas jsonb not null default '{}',
  finalizado_em timestamptz,
  ultimo_email_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- "em atraso" é derivado: status='aberto' and prazo < current_date (sem job p/ isso)
create index on planos_acao (org_id, status, prazo);
create index on planos_acao (inspecao_id);
create index on planos_acao (modelo_id);
create unique index planos_por_nc_unico on planos_acao (inspecao_id, modelo_id, questao_keys);  -- disparo idempotente

-- =====================================================================
-- 7. APROVAÇÕES (de inspeção e de plano). Config das etapas vive na
-- definição do formulário / modelo de plano; aqui ficam as decisões.
-- =====================================================================

create table aprovacoes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  alvo_tipo text not null check (alvo_tipo in ('inspecao','plano')),
  inspecao_id uuid references inspecoes(id) on delete cascade,
  plano_id uuid references planos_acao(id) on delete cascade,
  etapa int not null check (etapa >= 1),
  aprovador_id uuid not null references membros(id) on delete restrict,
  decisao text not null check (decisao in ('aprovada','reprovada')),
  comentario text,
  em timestamptz not null default now(),
  constraint alvo_coerente check (
    (alvo_tipo = 'inspecao' and inspecao_id is not null and plano_id is null) or
    (alvo_tipo = 'plano' and plano_id is not null and inspecao_id is null)),
  constraint reprovar_exige_comentario check (decisao = 'aprovada' or comentario is not null)
);
create unique index aprovacao_unica_inspecao on aprovacoes (inspecao_id, etapa, aprovador_id) where inspecao_id is not null;
create unique index aprovacao_unica_plano on aprovacoes (plano_id, etapa, aprovador_id) where plano_id is not null;
create index on aprovacoes (aprovador_id);

-- =====================================================================
-- 8. WORKFLOWS (v1.x — tabelas já criadas p/ não migrar depois)
-- =====================================================================

create table workflows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  nome text not null,
  grafo jsonb not null default '{"blocos":[],"arestas":[]}',
  questoes_repetidas uuid[] not null default '{}',
  iniciadores uuid[] not null default '{}',  -- membros que podem iniciar
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, nome)
);

create table workflow_instancias (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  workflow_id uuid not null references workflows(id) on delete restrict,
  grafo_snapshot jsonb not null,
  status text not null default 'em_andamento',   -- ou o nome de um bloco Status
  status_cor text,
  iniciada_por uuid references membros(id) on delete set null,
  avaliado_id uuid references avaliados(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on workflow_instancias (org_id, status);
create index on workflow_instancias (workflow_id);

create table workflow_etapas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  instancia_id uuid not null references workflow_instancias(id) on delete cascade,
  bloco_id text not null,
  responsavel_id uuid references membros(id) on delete set null,
  prazo timestamptz,
  status text not null default 'pendente' check (status in ('pendente','concluida','cancelada')),
  inspecao_id uuid references inspecoes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instancia_id, bloco_id)
);
create index on workflow_etapas (responsavel_id, status);
create index on workflow_etapas (inspecao_id);

alter table inspecoes
  add constraint inspecoes_wf_etapa_fk
  foreign key (workflow_etapa_id) references workflow_etapas(id) on delete set null;
create index on inspecoes (workflow_etapa_id);

-- =====================================================================
-- 9. INFRA: push, outbox de e-mail, importações
-- =====================================================================

create table push_inscricoes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  membro_id uuid not null references membros(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index on push_inscricoes (membro_id);

-- Todo e-mail passa por aqui: o job envia e marca. idem_key evita duplicar.
create table emails_saida (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  idem_key text not null unique,            -- ex.: 'relatorio:{inspecao_id}:{email}'
  para text not null,
  assunto text not null,
  template text not null,
  dados jsonb not null default '{}',
  status text not null default 'pendente' check (status in ('pendente','enviado','falhou')),
  tentativas int not null default 0,
  provedor_id text,
  erro text,
  enviar_apos timestamptz not null default now(),
  enviado_em timestamptz,
  created_at timestamptz not null default now()
);
create index on emails_saida (status, enviar_apos) where status = 'pendente';

create table importacoes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  tipo text not null check (tipo in ('avaliados','formulario')),
  arquivo_path text not null,
  mapeamento jsonb,
  status text not null default 'pendente' check (status in ('pendente','processando','concluida','erro')),
  linhas_ok int not null default 0,
  linhas_erro int not null default 0,
  erros jsonb not null default '[]',
  criado_por uuid references membros(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on importacoes (org_id, created_at desc);

-- triggers de updated_at
do $$
declare t text;
begin
  foreach t in array array[
    'organizacoes','funcoes','membros','equipes','campos_avaliado','avaliados',
    'formularios','questoes_preconfig','inspecoes','respostas','agendamentos',
    'ocorrencias','planos_modelo','planos_acao','workflows','workflow_instancias',
    'workflow_etapas','importacoes']
  loop
    execute format('create trigger %I_touch before update on %I for each row execute function app.touch_updated_at()', t, t);
  end loop;
end $$;

-- =====================================================================
-- 10. FUNÇÕES DE AUTORIZAÇÃO (security definer, usadas pelas policies)
-- =====================================================================

create or replace function app.membro_id(p_org uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from membros where org_id = p_org and user_id = auth.uid() and ativo
$$;

create or replace function app.is_membro(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros where org_id = p_org and user_id = auth.uid() and ativo)
$$;

create or replace function app.tem_acao(p_org uuid, p_acao text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from membros m
    left join funcoes f on f.id = m.funcao_id
    where m.org_id = p_org and m.user_id = auth.uid() and m.ativo
      and (m.is_master or p_acao = any(coalesce(f.acoes, '{}')))
  )
$$;

-- equipes do usuário atual numa org
create or replace function app.minhas_equipes(p_org uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  select em.equipe_id from equipe_membros em
  join membros m on m.id = em.membro_id
  where m.org_id = p_org and m.user_id = auth.uid() and m.ativo
$$;

-- tem permissão de escopo (direta ou via equipe)?
create or replace function app.tem_escopo(p_org uuid, p_tipo text, p_alvo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from permissoes p
    where p.org_id = p_org and p.tipo = p_tipo and p.alvo_id = p_alvo
      and ( (p.sujeito_tipo = 'membro' and p.sujeito_id = app.membro_id(p_org))
         or (p.sujeito_tipo = 'equipe' and p.sujeito_id in (select app.minhas_equipes(p_org))) )
  )
$$;

create or replace function app.pode_aplicar_formulario(p_org uuid, p_form uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select app.tem_acao(p_org, 'gerenciar_formularios')
      or (app.tem_acao(p_org, 'aplicar') and app.tem_escopo(p_org, 'formulario', p_form))
$$;

create or replace function app.pode_ver_inspecao(p_org uuid, p_responsavel uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select app.is_membro(p_org) and (
       p_responsavel = app.membro_id(p_org)
    or app.tem_acao(p_org, 'ver_todas_inspecoes')
    or app.tem_escopo(p_org, 'ver_inspecoes_de_membro', p_responsavel)
    or exists (
         select 1 from equipe_membros em
         where em.membro_id = p_responsavel
           and app.tem_escopo(p_org, 'ver_inspecoes_de_equipe', em.equipe_id))
  )
$$;

-- =====================================================================
-- 11. ROW LEVEL SECURITY
-- Padrão: ler = membro da org (+ escopo onde faz sentido);
-- escrever = ação da função. Service role ignora RLS (jobs/link público).
-- =====================================================================

alter table organizacoes        enable row level security;
alter table funcoes             enable row level security;
alter table membros             enable row level security;
alter table equipes             enable row level security;
alter table equipe_membros      enable row level security;
alter table permissoes          enable row level security;
alter table campos_avaliado     enable row level security;
alter table avaliados           enable row level security;
alter table formularios         enable row level security;
alter table formulario_versoes  enable row level security;
alter table formulario_avaliados enable row level security;
alter table questoes_preconfig  enable row level security;
alter table inspecoes           enable row level security;
alter table respostas           enable row level security;
alter table anexos              enable row level security;
alter table inspecao_eventos    enable row level security;
alter table agendamentos        enable row level security;
alter table ocorrencias         enable row level security;
alter table planos_modelo       enable row level security;
alter table planos_acao         enable row level security;
alter table aprovacoes          enable row level security;
alter table workflows           enable row level security;
alter table workflow_instancias enable row level security;
alter table workflow_etapas     enable row level security;
alter table push_inscricoes     enable row level security;
alter table emails_saida        enable row level security;   -- sem policy: só service role
alter table importacoes         enable row level security;

-- organização
create policy org_ler on organizacoes for select using (app.is_membro(id));
create policy org_editar on organizacoes for update using (app.tem_acao(id, 'gerenciar_permissoes'));

-- funções / membros / equipes / permissões
create policy funcoes_ler on funcoes for select using (app.is_membro(org_id));
create policy funcoes_escrever on funcoes for all
  using (app.tem_acao(org_id, 'gerenciar_permissoes')) with check (app.tem_acao(org_id, 'gerenciar_permissoes'));

create policy membros_ler on membros for select using (app.is_membro(org_id));
create policy membros_escrever on membros for all
  using (app.tem_acao(org_id, 'gerenciar_permissoes')) with check (app.tem_acao(org_id, 'gerenciar_permissoes'));

create policy equipes_ler on equipes for select using (app.is_membro(org_id));
create policy equipes_escrever on equipes for all
  using (app.tem_acao(org_id, 'gerenciar_permissoes')) with check (app.tem_acao(org_id, 'gerenciar_permissoes'));

create policy equipe_membros_ler on equipe_membros for select
  using (exists (select 1 from equipes e where e.id = equipe_id and app.is_membro(e.org_id)));
create policy equipe_membros_escrever on equipe_membros for all
  using (exists (select 1 from equipes e where e.id = equipe_id and app.tem_acao(e.org_id, 'gerenciar_permissoes')))
  with check (exists (select 1 from equipes e where e.id = equipe_id and app.tem_acao(e.org_id, 'gerenciar_permissoes')));

create policy permissoes_ler on permissoes for select using (app.is_membro(org_id));
create policy permissoes_escrever on permissoes for all
  using (app.tem_acao(org_id, 'gerenciar_permissoes')) with check (app.tem_acao(org_id, 'gerenciar_permissoes'));

-- avaliados: gestor vê todos; aplicador vê os do seu escopo (ou todos se não tiver nenhum escopo de avaliado)
create policy campos_avaliado_ler on campos_avaliado for select using (app.is_membro(org_id));
create policy campos_avaliado_escrever on campos_avaliado for all
  using (app.tem_acao(org_id, 'gerenciar_avaliados')) with check (app.tem_acao(org_id, 'gerenciar_avaliados'));

create policy avaliados_ler on avaliados for select using (
  app.is_membro(org_id) and (
       app.tem_acao(org_id, 'gerenciar_avaliados')
    or app.tem_acao(org_id, 'ver_todas_inspecoes')
    or app.tem_escopo(org_id, 'avaliado', id)
    or not exists (
         select 1 from permissoes p
         where p.org_id = avaliados.org_id and p.tipo = 'avaliado'
           and ((p.sujeito_tipo = 'membro' and p.sujeito_id = app.membro_id(avaliados.org_id))
             or (p.sujeito_tipo = 'equipe' and p.sujeito_id in (select app.minhas_equipes(avaliados.org_id)))))
  ));
create policy avaliados_escrever on avaliados for all
  using (app.tem_acao(org_id, 'gerenciar_avaliados')) with check (app.tem_acao(org_id, 'gerenciar_avaliados'));

-- formulários
create policy formularios_ler on formularios for select using (
  app.tem_acao(org_id, 'gerenciar_formularios') or app.pode_aplicar_formulario(org_id, id)
  or app.tem_acao(org_id, 'ver_todas_inspecoes'));
create policy formularios_escrever on formularios for all
  using (app.tem_acao(org_id, 'gerenciar_formularios')) with check (app.tem_acao(org_id, 'gerenciar_formularios'));

create policy versoes_ler on formulario_versoes for select using (app.is_membro(org_id));
create policy versoes_inserir on formulario_versoes for insert with check (app.tem_acao(org_id, 'gerenciar_formularios'));

create policy form_avaliados_ler on formulario_avaliados for select
  using (exists (select 1 from formularios f where f.id = formulario_id and app.is_membro(f.org_id)));
create policy form_avaliados_escrever on formulario_avaliados for all
  using (exists (select 1 from formularios f where f.id = formulario_id and app.tem_acao(f.org_id, 'gerenciar_formularios')))
  with check (exists (select 1 from formularios f where f.id = formulario_id and app.tem_acao(f.org_id, 'gerenciar_formularios')));

create policy preconfig_ler on questoes_preconfig for select using (app.is_membro(org_id));
create policy preconfig_escrever on questoes_preconfig for all
  using (app.tem_acao(org_id, 'gerenciar_formularios')) with check (app.tem_acao(org_id, 'gerenciar_formularios'));

-- inspeções
create policy inspecoes_ler on inspecoes for select using (app.pode_ver_inspecao(org_id, responsavel_id));
create policy inspecoes_criar on inspecoes for insert with check (
  responsavel_id = app.membro_id(org_id) and app.pode_aplicar_formulario(org_id, formulario_id));
-- dono edita enquanto rascunho (e pode finalizá-la); depois só quem tem editar_inspecao.
-- Ninguém muda status para em_aprovacao/aprovada/reprovada pelo cliente: só o servidor (service role).
create policy inspecoes_editar on inspecoes for update
  using (
    (responsavel_id = app.membro_id(org_id) and status = 'rascunho')
    or app.tem_acao(org_id, 'editar_inspecao'))
  with check (
    status in ('rascunho','completa')
    and (responsavel_id = app.membro_id(org_id) or app.tem_acao(org_id, 'editar_inspecao')));
create policy inspecoes_excluir on inspecoes for delete using (app.tem_acao(org_id, 'excluir_inspecao'));

create policy respostas_ler on respostas for select using (
  exists (select 1 from inspecoes i where i.id = inspecao_id and app.pode_ver_inspecao(i.org_id, i.responsavel_id)));
create policy respostas_escrever on respostas for all using (
  exists (select 1 from inspecoes i where i.id = inspecao_id and (
    (i.responsavel_id = app.membro_id(i.org_id) and i.status = 'rascunho') or app.tem_acao(i.org_id, 'editar_inspecao'))))
  with check (
  exists (select 1 from inspecoes i where i.id = inspecao_id and i.org_id = respostas.org_id and (
    (i.responsavel_id = app.membro_id(i.org_id) and i.status = 'rascunho') or app.tem_acao(i.org_id, 'editar_inspecao'))));

create policy anexos_ler on anexos for select using (
  exists (select 1 from inspecoes i where i.id = inspecao_id and app.pode_ver_inspecao(i.org_id, i.responsavel_id)));
create policy anexos_escrever on anexos for all using (
  exists (select 1 from inspecoes i where i.id = inspecao_id and (
    i.responsavel_id = app.membro_id(i.org_id) or app.tem_acao(i.org_id, 'editar_inspecao'))))
  with check (
  exists (select 1 from inspecoes i where i.id = inspecao_id and i.org_id = anexos.org_id and (
    i.responsavel_id = app.membro_id(i.org_id) or app.tem_acao(i.org_id, 'editar_inspecao'))));

create policy eventos_ler on inspecao_eventos for select using (
  exists (select 1 from inspecoes i where i.id = inspecao_id and app.pode_ver_inspecao(i.org_id, i.responsavel_id)));
-- eventos só são escritos pelo servidor (service role)

-- agendamentos
create policy agendamentos_ler on agendamentos for select using (
  app.tem_acao(org_id, 'gerenciar_agendamentos') or app.membro_id(org_id) = any(responsaveis));
create policy agendamentos_escrever on agendamentos for all
  using (app.tem_acao(org_id, 'gerenciar_agendamentos')) with check (app.tem_acao(org_id, 'gerenciar_agendamentos'));

create policy ocorrencias_ler on ocorrencias for select using (
  exists (select 1 from agendamentos a where a.id = agendamento_id and (
    app.tem_acao(a.org_id, 'gerenciar_agendamentos') or app.membro_id(a.org_id) = any(a.responsaveis))));
-- inativar: qualquer responsável (com justificativa, garantida pelo check)
create policy ocorrencias_inativar on ocorrencias for update using (
  exists (select 1 from agendamentos a where a.id = agendamento_id and (
    app.tem_acao(a.org_id, 'gerenciar_agendamentos') or app.membro_id(a.org_id) = any(a.responsaveis))));

-- planos de ação
create policy planos_modelo_ler on planos_modelo for select using (app.is_membro(org_id));
create policy planos_modelo_escrever on planos_modelo for all
  using (app.tem_acao(org_id, 'gerenciar_planos')) with check (app.tem_acao(org_id, 'gerenciar_planos'));

create policy planos_ler on planos_acao for select using (
  app.tem_acao(org_id, 'gerenciar_planos')
  or responsavel_membro_id = app.membro_id(org_id)
  or exists (select 1 from inspecoes i where i.id = inspecao_id and app.pode_ver_inspecao(i.org_id, i.responsavel_id)));
create policy planos_editar on planos_acao for update using (
  app.tem_acao(org_id, 'gerenciar_planos') or responsavel_membro_id = app.membro_id(org_id));

-- aprovações: insere quem é aprovador (validação da etapa no servidor)
create policy aprovacoes_ler on aprovacoes for select using (app.is_membro(org_id));
create policy aprovacoes_inserir on aprovacoes for insert with check (
  aprovador_id = app.membro_id(org_id) and app.tem_acao(org_id, 'aprovar'));

-- workflows
create policy workflows_ler on workflows for select using (app.is_membro(org_id));
create policy workflows_escrever on workflows for all
  using (app.tem_acao(org_id, 'gerenciar_workflows')) with check (app.tem_acao(org_id, 'gerenciar_workflows'));
create policy wf_inst_ler on workflow_instancias for select using (app.is_membro(org_id));
create policy wf_etapas_ler on workflow_etapas for select using (app.is_membro(org_id));

-- push: cada um gerencia as próprias inscrições
create policy push_proprias on push_inscricoes for all
  using (membro_id = app.membro_id(org_id)) with check (membro_id = app.membro_id(org_id));

-- importações
create policy importacoes_ler on importacoes for select using (app.is_membro(org_id));
create policy importacoes_criar on importacoes for insert with check (
  app.tem_acao(org_id, 'gerenciar_avaliados') or app.tem_acao(org_id, 'gerenciar_formularios'));

-- =====================================================================
-- 12. VIEWS úteis (respeitam RLS via security_invoker)
-- =====================================================================

create view planos_acao_situacao with (security_invoker = true) as
  select p.*,
         case when p.status = 'aberto' and p.prazo < (now() at time zone 'utc')::date
              then 'em_atraso' else p.status end as situacao
  from planos_acao p;

-- última resposta de cada questão por avaliado+formulário (reincidência / preenchimento automático)
create view ultima_resposta with (security_invoker = true) as
  select distinct on (i.avaliado_id, i.formulario_id, r.questao_key)
         i.org_id, i.avaliado_id, i.formulario_id, r.questao_key,
         r.valor, r.conforme, i.finalizada_em
  from respostas r
  join inspecoes i on i.id = r.inspecao_id
  where i.status <> 'rascunho'
  order by i.avaliado_id, i.formulario_id, r.questao_key, i.finalizada_em desc;
