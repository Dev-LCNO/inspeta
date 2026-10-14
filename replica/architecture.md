# Arquitetura — clone do CLICQ (inspeções de qualidade offline-first)

Base: `replica/recon.md` (43 telas, 9 fluxos) e `replica/features.csv` (69 itens).
Escopo assumido: **web + PWA instalável no celular**, módulo **Processos**, multi-empresa (uso da consultoria + revenda SaaS).
Clean-room: só APIs oficiais com as suas chaves; nenhum endpoint, código ou asset da PariPassu.

---

## 1. Stack

| camada | escolha | por quê |
|---|---|---|
| web + API | **Next.js 15 (App Router) + TypeScript** | uma base só para backoffice, PWA e rotas de servidor |
| app de campo | **PWA** (mesmo Next.js) com **Serwist** (service worker) + **Dexie** (IndexedDB) | instala pelo navegador, funciona offline, sem loja na v1. Câmera, foto e leitor de código funcionam no navegador. **Expo** só se um cliente exigir coletor Zebra/loja de apps (v2) |
| motor de formulário | pacote **`@app/form-engine`** (TS puro, sem dependências de UI) | a mesma função calcula visibilidade, nota, desconto e NC no celular e no servidor; o servidor recalcula e é a fonte da verdade |
| validação | **zod** | um schema único para o JSON do formulário, as respostas e os payloads de sync |
| estilo | Tailwind + tokens do `/replica-design` | — |
| banco | **Postgres no Supabase (região sa-east-1, São Paulo)** | gerenciado, RLS nativo, Storage e Auth juntos; latência boa para o Acre |
| ORM | **Drizzle** (servidor) + `supabase-js` (cliente, protegido por RLS) | Drizzle só onde a lógica é do servidor |
| auth | **Supabase Auth** (e-mail + senha, convite por link mágico) | o original usa usuário e senha; convite resolve o onboarding de aplicadores |
| arquivos | **Supabase Storage**, bucket privado `org/{org_id}/…` com URLs assinadas | fotos, assinaturas, PDFs, logos |
| PDF | **@react-pdf/renderer** rodando em job | layout por componentes, sem Chrome headless |
| e-mail | **Resend** + tabela `emails_saida` (outbox) | domínio próprio verificado; o outbox garante que cada e-mail sai uma vez só |
| push | **Web Push (VAPID)** | notifica o agendamento no PWA (Android e iOS 16.4+ com o app instalado) |
| jobs | **Inngest** (eventos + cron) | retry, idempotência e fan-out sem worker próprio |
| pagamentos | **Stripe Billing** (assinatura por organização, cobrança por aplicador) — fase 4 | boleto e Pix via Stripe BR |
| hospedagem | **Vercel** (região `gru1`) | deploy por git, cron e edge prontos |
| observabilidade | Sentry + logs do Supabase | — |

Um banco, um app Next.js e um pacote compartilhado. Sem microsserviços.

---

## 2. Schema

**27 tabelas, 50 policies de RLS, 89 índices, 2 views.** O arquivo completo está em `replica/schema.sql`.

**Acesso: Row Level Security em todas as tabelas.** O cliente (web e PWA) fala direto com o Postgres via `supabase-js`, e o RLS decide o que cada um vê. O servidor usa a *service role* apenas para quatro coisas: link público de plano de ação, jobs, mudanças de status de aprovação e escrita do log de auditoria.

### Duas camadas de permissão (iguais às do original)
- **Função** (`funcoes.acoes[]`): o que a pessoa **faz**. As ações são `gerenciar_formularios`, `aplicar`, `editar_inspecao`, `excluir_inspecao`, `ver_todas_inspecoes`, `gerenciar_avaliados`, `gerenciar_planos`, `gerenciar_agendamentos`, `gerenciar_workflows`, `gerenciar_permissoes`, `aprovar` e `ver_painel`. O `is_master` libera tudo.
- **Permissão de escopo** (`permissoes`): o que a pessoa **alcança**, ou seja, quais formulários, quais avaliados e as inspeções de quem. Pode ser dada por membro ou por equipe.

### Decisão central: formulário = documento JSON versionado
Tópicos, questões e opções **não** viram tabelas. O formulário tem um `rascunho jsonb` editável. **Publicar** grava uma linha **imutável** em `formulario_versoes`, e cada inspeção aponta para a versão em que foi feita.
- O app offline baixa 1 JSON por formulário e roda o motor de nota localmente.
- Editar o formulário nunca altera inspeções antigas. Um trigger bloqueia o `UPDATE` até para a service role.
- Toda questão e opção tem uma `key` uuid estável entre versões. É por essa key que `respostas`, reincidência e preenchimento automático se ligam.

Formato do documento (validado por zod):

```jsonc
{
  "config": {
    "calcular_nota": true, "ocultar_nota": false, "casas_decimais": 1,
    "formato_nota": "percentual",                 // pontos | percentual | ambos
    "classificacoes": [{"nome":"Bom","cor":"#1a7f37","min":80,"max":100}, …],
    "geo": "inicio_fim",                          // off | inicio | fim | inicio_fim
    "preenchimento_sequencial": true,
    "reincidencia_meses": 3,
    "aprovacao": {"etapas":[{"aprovadores":["membro_id"]}]},
    "relatorio": {"colunas":2,"fotos_por":"questao","cor":"#…","mostrar_nota_anterior":true,
                  "emails":{"avaliado":true,"extras":["…"],"idioma":"pt-BR","quando":"ao_finalizar"}}
  },
  "topicos": [{
    "key":"uuid","titulo":"Câmara fria","depende_de":{"questao":"uuid","opcao":"uuid"},
    "questoes":[{
      "key":"uuid","titulo":"Temperatura da câmara (°C)","tipo":"numerica",
      "obrigatoria":true,"foto_obrigatoria":false,"ajuda":{"texto":"…","arquivo":null},
      "preenchimento_automatico":false,"preenchimento_unico":false,
      "numerica":{"formato":"decimal","limite":{"min":-2,"max":4,"obs_obrigatoria":true},
                  "faixas_nota":[{"ate":4,"pontos":10},{"ate":8,"pontos":5},{"ate":null,"pontos":0}]},
      "plano_acao_modelo_id":"uuid"
    },{
      "key":"uuid","tipo":"escolha_simples","titulo":"Produtos vencidos na área de venda?",
      "opcoes":[{"key":"uuid","texto":"Não","pontos":10,"conforme":true},
                {"key":"uuid","texto":"Sim","pontos":0,"conforme":false,
                 "desconto":{"pct":100,"escopo":"topico"}},
                {"key":"uuid","texto":"N/A","na":true}]
    }]
  }]
}
```

### Regras que o banco garante (testadas)
| regra | como | teste |
|---|---|---|
| sync offline repetido não duplica inspeção | `unique (org_id, client_uuid)` + upsert | T5 ✅ |
| resposta reenviada substitui a anterior | `unique (inspecao_id, questao_key, amostra_idx)` | T6 ✅ |
| aplicador só cria inspeção em formulário permitido e em nome próprio | policy `inspecoes_criar` | T3 T4 ✅ |
| aplicador finaliza, mas não edita depois | policy `inspecoes_editar` com `using` + `with check` | T7 ✅ (bug encontrado e corrigido no teste) |
| aplicador não se auto-aprova | `with check status in ('rascunho','completa')` | T17 ✅ |
| outra empresa não vê nada | RLS por `org_id` | T9 ✅ |
| visibilidade por equipe | `pode_ver_inspecao` + `permissoes` | T8 T12 ✅ |
| versão publicada imutável | trigger | T11b ✅ |
| job de agendamento rodando 2x não duplica | `unique (agendamento_id, previsto_em)` | T13 ✅ |
| inativar exige justificativa | check | T13 ✅ |
| plano de ação disparado 2x não duplica | unique index | T15 ✅ |
| "em atraso" sem job | view `planos_acao_situacao` | T14 ✅ |

---

## 3. API

A maior parte da leitura e do CRUD simples é feita pelo **cliente direto no Postgres com RLS**. A tabela abaixo lista só o que precisa de **lógica de servidor**: route handlers (`app/api/...`) e server actions do Next.js. "Membro" significa sessão válida; a ação exigida aparece entre parênteses.

### F00 — Conta e onboarding
| método rota | faz | quem | entrada | saída |
|---|---|---|---|---|
| POST `/api/orgs` | cria organização + membro master + funções padrão (Administrador, Aplicador, Supervisor) | usuário logado sem org | nome, fuso | org |
| POST `/api/orgs/:org/convites` | convida membro por e-mail (link mágico) | `gerenciar_permissoes` | email, nome, funcao_id, equipes[] | convite |
| POST `/api/convites/:token/aceitar` | vincula auth.user ao membro | público com token | — | sessão |

### F01 — Formulários
| método rota | faz | quem | entrada | saída |
|---|---|---|---|---|
| (cliente) `formularios` CRUD | lista, cria, salva rascunho | `gerenciar_formularios` | — | — |
| POST `/api/formularios/:id/publicar` | valida o rascunho (zod + fórmulas + faixas sem sobreposição + dependências sem ciclo), grava a versão N+1 e aponta `versao_publicada_id` | `gerenciar_formularios` | — | versão |
| POST `/api/formularios/:id/duplicar` | copia o formulário (inclusive a partir de modelo) gerando novas keys | `gerenciar_formularios` | nome | formulário |
| GET `/api/formularios/modelo-importacao.xlsx` | baixa a planilha modelo | membro | — | xlsx |
| POST `/api/formularios/importar` | sobe xlsx → importacao → rascunho | `gerenciar_formularios` | arquivo | importacao_id |
| POST `/api/formularios/:id/preview-nota` | roda o motor com respostas fictícias (usado pelo editor) | `gerenciar_formularios` | respostas | nota, NCs |

### F02 — Aplicação e sync offline (núcleo)
| método rota | faz | quem | entrada | saída |
|---|---|---|---|---|
| GET `/api/sync/pacote?desde=` | entrega o que o aparelho precisa: versões publicadas permitidas, avaliados visíveis, últimas respostas (reincidência/autopreenchimento), ocorrências do usuário e modelos de plano. Responde só o delta por `updated_at` | `aplicar` | cursor | pacote + novo cursor |
| POST `/api/sync/inspecoes` | lote de inspeções do outbox: upsert por `client_uuid`, upsert de respostas, **recalcula nota/NC com o form-engine**, grava evento; se a inspeção vier `completa`, dispara o evento `inspecao/finalizada` | `aplicar` | até 20 inspeções com respostas | por item: ok / conflito / erro |
| POST `/api/anexos/upload-url` | gera URL assinada de upload para a foto (direto ao Storage) | dono da inspeção | client_uuid, mime, bytes | url, path |
| POST `/api/anexos/:client_uuid/confirmar` | marca `enviado=true` depois do upload | dono | — | ok |

### F03/F04 — Pós-finalização, relatório e planos
| método rota | faz | quem | entrada | saída |
|---|---|---|---|---|
| GET `/api/inspecoes/:id/relatorio.pdf` | URL assinada do PDF (gera se ainda não existir) | quem vê a inspeção | — | redirect |
| POST `/api/inspecoes/:id/enviar-relatorio` | enfileira e-mail no outbox | quem vê | emails[] | ok |
| POST `/api/inspecoes/:id/reabrir` | volta a inspeção para rascunho (com log) | `editar_inspecao` | motivo | inspeção |
| GET `/api/inspecoes/:id/log.xlsx` | exporta `inspecao_eventos` | quem vê | — | xlsx |
| GET `/api/inspecoes/export.xlsx` | exporta o histórico filtrado | `ver_todas_inspecoes` | filtros | xlsx |
| POST `/api/planos/:id/reenviar` | novo token + e-mail | `gerenciar_planos` | email | ok |
| GET `/p/:token` (página) | responder plano sem login | público com token (hash conferido no servidor, expira 30 dias após o prazo) | — | página S26 |
| POST `/api/p/:token/responder` | grava respostas; finaliza ou envia para aprovação | público com token | respostas, anexos | status |

### F05 — Agendamentos
| método rota | faz | quem | entrada | saída |
|---|---|---|---|---|
| (cliente) `agendamentos` insert/update | cria/edita a regra | `gerenciar_agendamentos` | — | — |
| POST `/api/agendamentos/:id/materializar` | gera as ocorrências dos próximos 14 dias na hora (sem esperar o cron) | `gerenciar_agendamentos` | — | n ocorrências |
| POST `/api/ocorrencias/:id/inativar` | inativa só esta ou "esta e as seguintes", com justificativa | responsável ou gestor | escopo, justificativa | n afetadas |
| POST `/api/push/inscrever` | salva a inscrição Web Push | membro | subscription | ok |

### F07 — Aprovações
| método rota | faz | quem | entrada | saída |
|---|---|---|---|---|
| GET `/api/aprovacoes/pendentes` | o que espera a minha decisão | `aprovar` | — | lista |
| POST `/api/aprovacoes` | decide a etapa; ao fechar a última, muda o status da inspeção/plano (service role) | aprovador da etapa | alvo, decisão, comentário | novo status |

### F08/F09 — Permissões e avaliados
| método rota | faz | quem | entrada | saída |
|---|---|---|---|---|
| (cliente) `funcoes`, `equipes`, `permissoes`, `membros` | CRUD | `gerenciar_permissoes` | — | — |
| POST `/api/avaliados/importar` | xlsx/csv → mapeamento de colunas → upsert por `codigo_externo` | `gerenciar_avaliados` | arquivo, mapeamento | importacao |
| GET `/api/avaliados/export.xlsx` | exporta | `gerenciar_avaliados` | filtros | xlsx |

### F06 — Workflows (fase 3)
| método rota | faz | quem |
|---|---|---|
| (cliente) `workflows` CRUD do grafo | editor visual | `gerenciar_workflows` |
| POST `/api/workflows/:id/iniciar` | cria a instância e a 1ª etapa | membro em `iniciadores` |
| (evento) `inspecao/finalizada` com `workflow_etapa_id` | avalia a condição (classificação), cria a próxima etapa ou fecha com Status | job |

### Webhooks
- **Entrada:** Stripe (`customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`) → `/api/webhooks/stripe`, com assinatura verificada e idempotente por `event.id`. Resend (bounce/complaint) → marca e-mail inválido.
- **Saída:** fase 4, webhook por organização em `inspecao.finalizada` e `plano.finalizado` para integrar com ERP/WMS do cliente (HMAC assinado).

### Jobs (Inngest)
| job | gatilho | faz |
|---|---|---|
| `inspecao-finalizada` | evento | gera o PDF → Storage; cria os planos de ação das NCs (idempotente pelo unique); enfileira e-mails; inicia a aprovação; avança o workflow |
| `enviar-emails` | cron 1 min | consome `emails_saida` pendentes (até 5 tentativas com backoff) |
| `materializar-ocorrencias` | cron diário 03:00 UTC | gera ocorrências dos próximos 14 dias de cada agendamento ativo |
| `notificar-ocorrencias` | cron 5 min | push para as ocorrências que vencem nos próximos 5 min e ainda não foram notificadas; marca `atrasada` as vencidas há mais de 2h |
| `lembrete-planos` | cron diário 11:00 UTC (08:00 em Brasília) | e-mail para os planos que vencem amanhã ou já venceram |
| `limpar-anexos-orfaos` | cron semanal | apaga do Storage os arquivos sem linha em `anexos` com mais de 7 dias |
| `processar-importacao` | evento | lê a planilha em streaming e grava erros por linha |

---

## 4. As partes que mordem

- **Offline e sync (o maior risco).** O PWA guarda no IndexedDB: pacote, rascunhos e um *outbox* de inspeções e fotos. Regras:
  1. Tudo nasce com `client_uuid` no aparelho.
  2. Fotos sobem separadas, comprimidas para ≤ 1600 px e ~300 KB **no aparelho** antes do upload.
  3. A inspeção só é enviada como `completa` depois de todas as fotos confirmadas.
  4. Em conflito (por exemplo, o gestor reabriu na web), o servidor vence e o app mostra aviso.
  5. O iOS pode limpar o armazenamento de um PWA não instalado, então o app pede `navigator.storage.persist()` e incentiva instalar na tela inicial.
- **Fuso horário.** Tudo em `timestamptz` UTC. Cada organização tem fuso (`America/Rio_Branco` é UTC−5, `America/Sao_Paulo` é UTC−3; o Brasil não tem horário de verão desde 2019, mas o código não pode assumir isso). Agendamento guarda o fuso da criação, e as ocorrências são calculadas com `date-fns-tz`. Relatórios mostram o horário local do avaliado.
- **Motor de nota igual nos dois lados.** O mesmo pacote roda no celular (prévia) e no servidor (oficial). Testes de propriedade cobrem: N/A sai do denominador, desconto de 100% no tópico zera só o tópico, faixas numéricas na fronteira (`ate` inclusivo), fórmula de cálculo com questão vazia (`valor_se_vazio`) e dependência escondendo questão obrigatória (questão escondida nunca é obrigatória).
- **Fórmulas de cálculo.** Nunca `eval`. Usar um parser seguro (`expr-eval` com funções desligadas) e validar ao publicar que `[n]` aponta para questões numéricas existentes.
- **Idempotência.** Sync (client_uuid), ocorrências (agendamento + horário), planos (inspeção + modelo + NCs), e-mails (`idem_key`) e Stripe (`event.id`). Webhooks e jobs podem rodar duas vezes sem efeito colateral.
- **Corridas.** Duas pessoas aplicando o mesmo agendamento: a ocorrência fica `completa` com a primeira inspeção (`update … where status='pendente'`) e a segunda vira inspeção avulsa. Duas abas editando o mesmo formulário: rascunho com `updated_at` como trava otimista.
- **Tamanho de arquivos.** Limite de 15 MB por anexo (check no banco + política do bucket). PDF com muitas fotos: usar miniaturas no relatório e um link para a galeria completa.
- **Busca.** Índices btree bastam no início; `pg_trgm` em `avaliados.nome` quando passar de alguns milhares.
- **Multi-tenant.** Toda tabela tem `org_id`, toda policy filtra por ele, e o `with check` impede gravar linha em outra organização. Ainda falta um teste automatizado de "nenhuma tabela sem policy" no CI.
- **Link público do plano.** O token cru vai só no e-mail; o banco guarda o sha256. Rate limit por IP na rota `/p/:token`.
- **E-mail.** SPF, DKIM e DMARC no domínio próprio desde o primeiro dia; relatórios saem de `relatorios@seudominio`.
- **LGPD.** Inspeções podem ter fotos de funcionários e geolocalização do aplicador. É preciso consentimento no primeiro login do app, exclusão de membro anonimizando (e não apagando) inspeções, e export dos dados da organização a pedido.

---

## 5. Ordem de construção

### Marco 1 — Fatia vertical (o loop inteiro, feio)
Criar conta → montar um formulário com escolha simples + numérica + foto → publicar → aplicar no celular **sem internet** → sincronizar → ver nota e NC na web → baixar PDF.
- Telas: S01, S03, S13, S14 (mínima), S04, S08–S10, S12, M01–M06, M08
- Tabelas: organizacoes, funcoes, membros, avaliados, formularios, formulario_versoes, inspecoes, respostas, anexos, inspecao_eventos
- Rotas: `/api/orgs`, `/publicar`, `/api/sync/pacote`, `/api/sync/inspecoes`, `/api/anexos/*`, `/relatorio.pdf`
- Pacote: `form-engine` com testes
- **Critério de pronto:** inspeção feita em modo avião aparece corretamente na web depois de reconectar, sem duplicar ao reenviar.

### Marco 2 — Must-haves
- **Formulários completos:** os 7 tipos de questão, obrigatoriedades, dependências entre tópicos, notas por opção e faixa, classificações, vincular avaliados (S14–S18, S17)
- **Avaliados:** CRUD, campos personalizados, importação com mapeamento (S21–S23)
- **Permissões:** funções, permissões por membro e convites (S30, S31)
- **Planos de ação:** modelos, disparo automático na NC, link público, status e atraso (S24–S26)
- **Relatório:** PDF configurável e e-mail automático (S16)
- **Inspeções:** histórico com filtros, detalhe, reabrir (S04, S12)

### Marco 3 — Should-haves
Equipes, agendamentos com recorrência + push (S05–S07, M09), aprovação de inspeção (S32), reincidência, preenchimento automático, geolocalização, leitor de código (M10), importação de formulário via Excel (S20), log em Excel, desconto, campos personalizados com dependência e **um painel de indicadores simples** (nota média por avaliado/mês, top NCs). O painel é a oportunidade, porque o original vende isso separado como Panorama.

### Marco 4 — Could-haves e comercial
Workflows (S27–S29), aprovação de plano, questões pré-configuradas (S19), convidados, preenchimento sequencial (M11), Stripe Billing, webhook de saída. Depois disso entra a v2: módulo Produto (defeitos e amostragem por lote), APPCC, gestão de documentos e app nativo com Expo para coletores.

### Marco 5 — Correções vindas do `/replica-entrepreneur`
Reservado para o que as avaliações reais dos usuários do CLICQ apontarem (o app tem nota 3,8 na Play Store, então há reclamações para garimpar).
