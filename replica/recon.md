# Recon map — CLICQ (PariPassu)

> Mapa de engenharia reversa **clean-room**: construído só a partir de fontes públicas (central de ajuda, site, lojas de apps). Nenhum código, APK, endpoint privado ou asset da PariPassu foi copiado. Data da varredura: 13/10/2026.

## 0. Escopo (premissas assumidas — confirme ou ajuste)

| Item | Premissa |
|---|---|
| App | CLICQ (PariPassu Aplicativos Especializados) — checklist/inspeção de qualidade para cadeia de alimentos |
| Plataformas | **Web (backoffice)** + **App mobile offline-first** (Android/iOS). Original: web em `clicq.paripassu.com.br`, login unificado em `acesso.paripassu.com.br`, app `br.com.paripassu.clicq` (50K+ downloads, nota 3,8 Play / 4,0 App Store) |
| Fatia (core loop) | **Montar formulário → agendar/aplicar inspeção (offline) → nota + não conformidades → plano de ação → relatório PDF/e-mail** |
| Fora da v1 | CLICQ Produto (defeitos/amostragem por lote), APPCC, Gestão de Documentos, Panorama (BI), coletores Zebra/Compex, conferência de preços |
| Para quem | Uso próprio da consultoria (CDs, supermercados, food service) e revenda como SaaS |

## 1. Fontes

| # | Fonte | URL | O que deu |
|---|---|---|---|
| 1 | Central de Conhecimento — índice CLICQ | https://conhecimento.paripassu.com.br/clicq | Lista completa de módulos e ~70 artigos |
| 2 | Tipos de questão (CLICQ 2.0) | https://conhecimento.paripassu.com.br/como-configurar-cada-tipo-de-quest%C3%A3o-no-clicq | 7 tipos + 7 configs gerais |
| 3 | Criar/configurar formulário | https://conhecimento.paripassu.com.br/como-criar-e-configurar-um-novo-formul%C3%A1rio-no-clicq | Abas Questões/Configurações/Relatório/Avaliados |
| 4 | Notas | https://conhecimento.paripassu.com.br/como-configurar-notas-nas-quest%C3%B5es-do-seu-formul%C3%A1rio-no-clicq | Algoritmo de pontuação |
| 5 | O que mudou na nova versão | https://conhecimento.paripassu.com.br/o-que-mudou-na-nova-vers%C3%A3o-do-clicq | Funções, permissões, desconto, aprovações, log, importação |
| 6 | Realizar inspeção (web) | https://conhecimento.paripassu.com.br/como-acessar-e-iniciar-uma-inspe%C3%A7%C3%A3o-no-clicq | Histórico, filtros, ações |
| 7 | Aplicar no app | https://conhecimento.paripassu.com.br/aplicar-questionarios-no-aplicativo-clicq | Fluxo mobile, rascunho, sync |
| 8 | Planos de ação | https://conhecimento.paripassu.com.br/como-acessar-e-gerenciar-seus-planos-de-a%C3%A7%C3%A3o-no-clicq | Histórico/modelos, status, link externo |
| 9 | Workflows | https://conhecimento.paripassu.com.br/como-criar-e-configurar-workflows-no-clicq | Editor visual de blocos |
| 10 | Permissões | https://conhecimento.paripassu.com.br/como-gerenciar-as-permiss%C3%B5es-usu%C3%A1rios-equipes-e-convidados-no-clicq | Usuários/Equipes/Convidados |
| 11 | Agendamentos | https://conhecimento.paripassu.com.br/como-realizar-a-gest%C3%A3o-de-tarefas- | Recorrência, notificação, inativação |
| 12 | Avaliados | https://conhecimento.paripassu.com.br/como-criar-e-gerenciar-cadastros-de-avaliados-no-clicq | Cadastro, importação, campos custom |
| 13 | Reincidência | https://conhecimento.paripassu.com.br/controlar-inconformidades-reincidentes-clicq | Ícones de resposta anterior |
| 14 | Página CLICQ Processo | https://www.paripassu.com.br/solucoes/clicq-processo/ | Posicionamento, APPCC, documentos |
| 15 | Página CLICQ Produto | https://www.paripassu.com.br/solucoes/clicq-produto/ | Módulo de produto/lote |
| 16 | Google Play | https://play.google.com/store/apps/details?id=br.com.paripassu.clicq | Descrição, versão 1.277.14, dados coletados |
| 17 | App Store | https://apps.apple.com/br/app/clicq/id1058023062 | Descrição, nota |
| — | Preço | não público (venda por demonstração) | — |

## 2. Inventário de telas

### Web (backoffice)
| ID | Tela | Como chega | Propósito | Componentes | Estados |
|---|---|---|---|---|---|
| S01 | Login | `/login` | e-mail + senha | form, link "esqueci senha" | erro, loading |
| S02 | Seletor de sistemas | pós-login | escolher módulo (Processos/Produto) | cards | 1 módulo → pula |
| S03 | Shell / menu lateral | sempre | Inspeções, Formulários, Avaliados, Planos de ação, Workflows, Permissões, Funções | sidebar, topbar | colapsado (mobile) |
| S04 | Inspeções — Histórico | menu | listar inspeções | tabela, busca, filtro de data, filtros avançados (Avaliado/Responsável/Formulário), menu ⋮ | vazio, carregando, filtrado sem resultado |
| S05 | Inspeções — Agendamentos (aba) | S04 | listar agendamentos | tabela, filtros, ⋮ Editar/Inativar, status | pendente, completa, atrasada, inativa |
| S06 | Modal "Agendar" | S05 | criar agendamento | select formulário/avaliado/responsáveis, data, multi-horários, "dia inteiro", recorrência, término | validação |
| S07 | Modal "Inativar agendamento" | S05 ⋮ | só este / todos os seguintes + justificativa | radio, textarea | — |
| S08 | Nova inspeção — escolher formulário | S04 "+ Nova inspeção" | lista de formulários | tabela/busca | sem formulários |
| S09 | Nova inspeção — escolher avaliado | S08 | lista de avaliados vinculados | tabela/busca | sem avaliados |
| S10 | Aplicação (web) | S09 | responder formulário | tópicos, questões, anexos (comentário/foto), nota parcial, "Finalizar" | obrigatória pendente, NC com anexo obrigatório (vermelho) |
| S11 | Inspeção finalizada | S10 | Nova inspeção / Encerrar | modal | — |
| S12 | Detalhe da inspeção | S04 clique na linha | respostas, nota, fotos, NC, aprovação | leitura, botões PDF/e-mail/log | em aprovação, aprovada, reprovada |
| S13 | Formulários — lista | menu | gerenciar formulários | cards/tabela, "+ Novo formulário" (Em branco / Modelo / Importar Excel) | vazio |
| S14 | Editor de formulário — aba Questões | S13 | montar tópicos e questões | sidebar de conteúdo (+ tópico/questão), blocos de questão, painel lateral de configurações, "+ Selecionar questão pré-configurada" | rascunho, salvo |
| S15 | Editor — aba Configurações | S14 | versão, doc de referência, aprovação, geolocalização, preenchimento sequencial, nota, classificações (faixas coloridas) | toggles, slider de faixas, color picker | — |
| S16 | Editor — aba Relatório | S14 | conteúdo do PDF, layout (cor, logos, 1/2 colunas, fotos por questão/tópico), e-mails (destinatários, idioma, quando enviar) | toggles, upload de logo | — |
| S17 | Editor — aba Avaliados | S14 | vincular avaliados ao formulário | lista com checkbox, "Vincular", X | nenhum vinculado = todos? (dúvida) |
| S18 | Modal configuração de nota da questão | S14 | pontos por opção / intervalos numéricos / desconto (% tópico ou formulário) | inputs, "+ intervalo" | intervalos bloqueados p/ não cruzar |
| S19 | Questões pré-configuradas | S13 submenu | biblioteca de questões reutilizáveis | tabela, editar | — |
| S20 | Importar formulário (Excel) | S13 | baixar modelo, subir planilha | upload, validação | erro de estrutura |
| S21 | Avaliados — lista | menu | CRUD de avaliados | tabela, "+ Novo avaliado", "Importar", ⋮ Editar/Excluir | vazio |
| S22 | Avaliados — aba Campos | S21 | ativar/desativar colunas, obrigatórios, "+ Novo campo" com dependência | checkboxes, toggles | — |
| S23 | Importar avaliados | S21 | upload → mapear colunas → importar | wizard 3 passos | erro, sucesso |
| S24 | Planos de ação — Histórico | menu | planos disparados | tabela, busca, data, filtro Situação, ⋮ Reenviar e-mail, PDF, Editar (copiar link/Responder) | aberto, finalizado, em atraso |
| S25 | Planos de ação — Meus planos (modelos) | S24 aba | modelos de plano (checklist) | cards, configurações (agrupado vs. individual por NC), aprovação | — |
| S26 | Responder plano de ação (link público) | e-mail/link | responsável externo preenche | formulário simplificado | expirado?, finalizado |
| S27 | Workflows — Meus workflows | menu | lista | "+ Novo workflow" | vazio |
| S28 | Editor de workflow (canvas) | S27 | blocos Início/Formulário/Condição/Status arrastáveis + conexões | canvas drag-and-drop, painel de bloco, Configurações (repetir respostas) | inválido (bloco sem formulário) |
| S29 | Workflows — em execução | S27 aba (inferido) | acompanhar instâncias | tabela de etapas/status | atrasado |
| S30 | Permissões | menu | abas Usuários / Equipes / Convidados | lista + perfil com abas Formulários / Visualizar inspeções / Visualizar avaliados | — |
| S31 | Funções | menu (master) | criar cargos e ações permitidas | matriz de permissões | — |
| S32 | Aprovações pendentes | S12 / notificação | aprovar/reprovar inspeção ou plano | botões, comentário | múltiplas etapas |

### App mobile
| ID | Tela | Propósito | Estados |
|---|---|---|---|
| M01 | Login | usuário + senha | offline sem cache |
| M02 | Home | Questionário, Histórico, Agendamentos, Sincronismo, "Ler código" | pendências de sync (badge) |
| M03 | Sincronismo | baixar formulários/avaliados, enviar inspeções | enviando, erro, último sync |
| M04 | Lista de questionários | busca, iniciar | vazio (precisa sync) |
| M05 | Lista de avaliados | busca | — |
| M06 | Aplicação | tópicos com Anterior/Próximo/Tópicos, alternativas (inline ≤3, picker >3), numérico, texto, data/hora, assinatura, cálculo; botões foto/comentário/ajuda/anexo PDF/leitor de código; ícone de reincidência; prévia de nota | obrigatória pendente, NC exige observação/foto |
| M07 | Assinatura | desenhar ou foto | — |
| M08 | Histórico local | rascunhos retomáveis, finalizadas | rascunho, aguardando envio, enviada |
| M09 | Agendamentos / notificação push | abrir inspeção agendada | atrasada |
| M10 | Leitor de código (câmera) | QR/barras → preenche questão ou inicia inspeção | sem permissão de câmera |
| M11 | Pós-finalização | "Aplicar de novo neste avaliado?" (preenchimento sequencial) | — |

**Total: 32 telas web + 11 mobile = 43.**

## 3. Fluxos

```
F01 Admin cria formulário
    S13 → S14 (tópicos/questões) → S18 (notas) → S15 (config + classificações) → S16 (relatório) → S17 (vincular avaliados) → salvar
    edge: cálculo referencia questão inexistente; intervalos numéricos sobrepostos; importar Excel fora do modelo

F02 Aplicador faz inspeção no app (core loop, offline)
    M01 → M03 sync → M04 → M05 → M06 (responde, foto, NC) → finalizar → M08 → M03 envia
    edge: sem internet o turno todo; app fecha no meio (rascunho); obrigatória pendente bloqueia; geolocalização negada
    happy path ≈ 4 toques até começar a responder

F03 Inspeção finalizada → nota → NC → plano de ação
    servidor recebe → calcula nota + classificação → para cada NC com plano vinculado gera PlanoAcao (agrupado ou por NC) → e-mail com link → S26 responsável responde → (aprovação) → finalizado
    edge: responsável sem conta (link público); prazo vence → "em atraso"; reenviar e-mail

F04 Relatório
    finalização → PDF (layout do formulário) → e-mail p/ avaliado + extras (no momento configurado) → S04 baixar/reenviar

F05 Agendamento recorrente
    S05 → S06 (formulário, avaliado, responsáveis, horários, recorrência, término) → job gera ocorrências → push no app no horário → M09 → F02
    edge: editar só esta vs. todas futuras; inativar com justificativa; inspeções já feitas nunca mudam

F06 Workflow
    S28 monta Início(form A) → Condição(classificação) → Formulário(B, responsável, prazo) / Status(Concluído) → instância iniciada por usuário autorizado → etapas avançam sozinhas
    edge: prazo vencido (notificar); respostas repetidas entre etapas

F07 Aprovação de inspeção
    finalização → etapa 1 (aprovadores) → … → aprovada/reprovada → status em S04/S12

F08 Permissões
    S30 usuário/equipe → formulários que pode aplicar, inspeções de quem pode ver, avaliados que vê; S31 funções definem ações (criar/editar/aplicar/excluir)

F09 Cadastro/importação de avaliados
    S21 → S23 upload → mapear colunas → importar
```

## 4. Componentes

| Componente | Variantes / estados | Telas |
|---|---|---|
| Sidebar | expandida, recolhida, item ativo | todas web |
| DataTable | busca, filtro de data, filtro avançado (coluna+valor), menu ⋮ por linha, paginação, vazio | S04 S05 S13 S21 S24 S27 S30 |
| Botão | primário, secundário, ícone, destrutivo, loading | todas |
| Badge de status | aberto, finalizado, em atraso, completa, pendente, aprovada, reprovada, inativa (cor configurável em workflow) | S04 S05 S24 S29 |
| Toggle com descrição | on/off + texto de ajuda | S15 S16 S18 |
| Editor de questão (bloco) | 7 tipos; selecionado / não | S14 |
| Painel lateral de configuração | gerais + específicas por tipo | S14 |
| Range slider de classificação | N faixas, nome, cor | S15 |
| Color picker | — | S15 S16 S28 |
| Upload | imagem/logo, PDF, Excel | S15 S16 S20 S23 |
| Mapeador de colunas | coluna da planilha → campo | S23 |
| Canvas de workflow | blocos arrastáveis, conectores, painel de bloco | S28 |
| Modal | confirmação, formulário, perigo | S06 S07 S11 |
| Seletor de recorrência | desativado, diário, semanal (dia), mensal; término nunca/data/N | S06 |
| Campo de questão (runtime) | choice inline/picker, numérico c/ limite, texto c/ scanner, data/hora, assinatura, cálculo (read-only) | S10 M06 |
| Barra de ações da questão | foto, comentário, ajuda, anexo, scanner, indicador de reincidência | M06 S10 |
| Pad de assinatura | desenhar, limpar, foto | M07 S10 |
| Toast | sucesso, erro, sync | todas |
| Indicador de sync | online, offline, pendentes N | M02 M03 |

## 5. Modelo de dados inferido

```
Organizacao  id, nome, logo, plano
             evidência: "Minha Conta", faturas, multi-empresa  | confiança: alta

Usuario      id, org_id, nome, email, senha_hash, funcao_id, unidade_logistica, ativo
             evidência: S30 perfil (Função, Unidade Logística) | alta

Funcao       id, org_id, nome, acoes[] (criar_formulario, editar, aplicar, excluir, gerenciar_workflows, aprovar…)
             evidência: artigo "Funções" | média (lista exata de ações não pública)

Equipe       id, org_id, nome; EquipeUsuario(equipe_id, usuario_id)  | alta
Convidado    id, org_id, email, formularios[]  | média

Permissao    sujeito (usuario|equipe), tipo (formulario|ver_inspecoes_de|avaliado), alvo_id, recebe_email bool
             evidência: abas Formulários / Visualizar Inspeções / Visualizar Avaliados | alta

Avaliado     id, org_id, nome*, email, telefone, cnpj, endereco, campos_custom jsonb, ativo
             evidência: S21/S22 | alta
CampoAvaliado id, org_id, nome, obrigatorio, visivel, depende_de_campo_id, depende_de_opcao  | alta

Formulario   id, org_id, modulo (processos|produto), nome, versao, calcular_nota, ocultar_nota, casas_decimais (0|1|2),
             formato_nota (pontos|percentual|ambos), doc_referencia_url, geo_captura (off|inicio|fim|ambos),
             preenchimento_sequencial, aprovacao_ativa, reincidencia_meses, config_relatorio jsonb, status
             evidência: S15/S16 | alta
Classificacao id, formulario_id, nome, cor, min, max  | alta
FormularioAvaliado (formulario_id, avaliado_id)  | alta

Topico       id, formulario_id, titulo, ordem, depende_de_questao_id, depende_de_opcao_id  | alta
Questao      id, topico_id, ordem, titulo, tipo (texto|numerica|escolha_simples|escolha_multipla|assinatura|data_hora|calculo),
             obrigatoria, foto_obrigatoria, doc_obrigatorio, ajuda_texto, ajuda_arquivo, preenchimento_automatico,
             preenchimento_unico, depende_de_questao_id, depende_de_opcao_id, pre_config_id,
             -- específicos:
             permitir_leitura_codigo, formato_numero (decimal|inteiro|percentual), limite_min, limite_max,
             obs_obrigatoria_fora_limite, incremento, campos_data (data|data_hora), formula, valor_se_vazio,
             plano_acao_modelo_id
             evidência: artigo tipos de questão | alta
Opcao        id, questao_id, texto, ordem, pontos, conforme (null|true|false), desconto_pct, desconto_escopo (topico|formulario)
             evidência: notas + desconto + reincidência | alta
FaixaNota    id, questao_id, valor_max, pontos   (numéricas)  | alta
QuestaoPreConfigurada  id, org_id, definicao jsonb  | média

Inspecao     id, org_id, formulario_id, formulario_versao, avaliado_id, responsavel_id, agendamento_id, workflow_instancia_id,
             status (rascunho|completa|em_aprovacao|aprovada|reprovada), iniciada_em, finalizada_em,
             geo_inicio, geo_fim, nota_pontos, nota_pct, classificacao_id, device_id, client_uuid (idempotência offline)
             evidência: S04/S12, log | alta
Resposta     id, inspecao_id, questao_id, valor jsonb, observacao, pontos, conforme, reincidente, amostra_idx
             evidência: S10/M06 | alta
Anexo        id, resposta_id|inspecao_id, tipo (foto|documento|assinatura), url, tamanho  | alta
LogInspecao  id, inspecao_id, usuario_id, acao, dados jsonb, em   (export Excel) | alta

Agendamento  id, formulario_id, avaliado_id, responsaveis[], data_inicio, horarios[], dia_inteiro,
             recorrencia (nenhuma|diaria|semanal|mensal), dia_semana, termino (nunca|data|qtd), termino_valor, ativo
OcorrenciaAgendada id, agendamento_id, previsto_em, status (pendente|completa|atrasada|inativa), justificativa, inspecao_id
             evidência: artigo agendamentos | alta

PlanoAcaoModelo id, org_id, nome, questoes (mesma estrutura de Formulario), agrupamento (por_inspecao|por_nc), aprovacao_ativa | alta
PlanoAcao    id, modelo_id, inspecao_id, resposta_id?, responsavel_email, token_publico, prazo, status (aberto|finalizado|em_atraso), respostas | alta

EtapaAprovacao id, alvo (formulario|plano_modelo), alvo_id, ordem, aprovadores[], idioma, frequencia_notificacao
Aprovacao    id, inspecao_id|plano_id, etapa_id, aprovador_id, decisao, comentario, em  | alta

Workflow     id, org_id, nome, grafo jsonb (blocos+arestas), questoes_repetidas[]
WorkflowInstancia id, workflow_id, status, iniciada_por, etapa_atual  | média (não há doc da execução)

Fornecedor   id, org_id, … (módulo produto)  | baixa — fora da v1
```

## 6. Regras de negócio-chave (o "algoritmo")

1. **Nota** = Σ pontos obtidos ÷ Σ pontos máximos possíveis × 100. Escolha simples = pontos da opção; múltipla = soma das marcadas; numérica = pontos da faixa em que o valor cai. Questões "N/A"/não aplicáveis saem do denominador (inferido — confirmar).
2. **Desconto** (ex-"nocaute"): opção marcada reduz X% da nota do **tópico** ou do **formulário**; 100% = zera.
3. **Classificação**: nota final cai numa faixa colorida → usada no relatório e nas **condições de workflow**.
4. **Não conformidade**: opção marcada como não conforme OU numérica fora do limite → exige observação/anexo se configurado → dispara plano de ação vinculado.
5. **Reincidência**: ao abrir inspeção, busca resposta anterior do mesmo avaliado/questão em N meses → ícone ✓/✗/–; no PDF, tag quando anterior e atual são NC.
6. **Preenchimento automático**: oferece última resposta (mesmo form + avaliado). **Incremento**: anterior + N. **Preenchimento único**: trava após finalizar.
7. **Dependência**: questão/tópico só aparece se opção X foi escolhida (agora entre tópicos).
8. **Finalizada no app = imutável no app**; edição só na web por autorizado, gravando log.

## 7. O que não dá (ou não deve) ser clonado

| Item | Motivo |
|---|---|
| Marca CLICQ, logo, ícones, prints, textos da central de ajuda | Propriedade da PariPassu — criar identidade própria |
| Código-fonte / APK / endpoints da API privada | Clean-room: não decompilar nem copiar |
| Base de clientes, formulários-modelo deles, dados do Rastreador/RAMA/INDEX | Dados e rede da PariPassu |
| Integração com Rastreador PariPassu / "Código PariPassu" | Ecossistema proprietário — substituir por QR/GS1 genérico |
| Integração com ERPs dos clientes | Fazer via API própria depois |

## 8. Tamanho

- **43 telas, 9 fluxos, ~22 entidades.**
- **Partes difíceis:** (1) **offline-first com sync e conflitos** (fotos grandes, idempotência, versão do formulário congelada na inspeção); (2) **motor de formulário** (dependências, cálculo, notas, descontos) rodando igual no app e no servidor; (3) **geração de PDF configurável** + e-mail; (4) agendamento recorrente com push; (5) editor visual de workflow.
- **Tamanho:** **L** (um trimestre) para tudo acima. **MVP do core loop (F01–F04 + F09, sem workflow/aprovação/agendamento): M** (algumas semanas).
