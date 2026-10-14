# Registro de construção

Nome **Inspeta** e ícone são provisórios (o `/replica-brand` decide o definitivo).
Todo o código, texto, ícone e cor foram escritos aqui, a partir do recon e das especificações.

## Marco 1 — fatia vertical · 14/10/2026 · concluído

**Critério de pronto (architecture.md §5):** uma inspeção feita em modo avião aparece corretamente na web depois de reconectar, sem duplicar ao reenviar.
**Situação:** atendido e coberto por teste automático (`tests/e2e-fatia.mjs`, 23 verificações, e `tests/e2e-offline-pwa.mjs`, 4 verificações). Rode `scripts/test.sh`.

| tela | estado | o que falta | o que foi mais difícil do que parecia |
|---|---|---|---|
| S01 Entrar | feito | autenticação real (Supabase Auth) | — |
| S03 Shell | feito | busca global ⌘K | — |
| S04 Histórico | feito | exportar Excel | os filtros na URL competiam com a busca com atraso |
| S05 Agendamentos | stub (M3) | tudo | — |
| S08–S10 Nova inspeção web | parcial | tela própria; hoje abre o app de campo no navegador | — |
| S11 Finalizada | feito (como M11) | — | — |
| S12 Detalhe | feito | editar/reabrir, aprovação | — |
| S13 Formulários | feito | duplicar, arquivar, modelos | — |
| S14 Editor | feito | arrastar e soltar (mover por botões funciona por teclado) | o botão Publicar ficava desabilitado depois do autosave — o teste pegou |
| S15 Configurações | feito | geolocalização | — |
| S16 Relatório | stub (M2) | layout configurável e e-mail | — |
| S17 Avaliados do formulário | feito | — | — |
| S18 Notas da questão | feito (no painel lateral) | — | o painel de 320 px espremia as opções; virou layout em duas linhas |
| S19, S20, S22–S32 | stubs com o marco previsto | — | — |
| M01 Login | feito (mesmo S01) | — | — |
| M02 Início | feito | — | — |
| M03 Sincronismo | feito | — | desligar o "modo avião" do app não disparava sync; corrigido |
| M04/M05 Escolher | feito | — | — |
| M06 Aplicação | feito | lista em folha para opções > 3 (hoje fica em linha) | manter a resposta na tela sem esperar o IndexedDB |
| M07 Assinatura | feito | — | — |
| M08 Histórico local | feito | — | — |
| M09 Agendamentos/push | não (M3) | tudo | — |
| M10 Leitor de código | parcial | câmera ao vivo; hoje é por foto (BarcodeDetector, Chrome/Android) | — |
| M11 Pós-finalização | feito | — | — |

**Matriz:** must 16 feitas + 9 parciais de 31 · should 4 + 3 de 19 · could 2 + 0 de 19.
**Must que faltam (todos no marco 2):** importar avaliados, e-mail do relatório e os quatro itens de plano de ação.

### Decisões tomadas sem confirmação (revisar)
- **Questão não respondida não conta na nota** (sai do numerador e do denominador, como N/A). Quem precisa que conte marca como obrigatória. A central de ajuda do original não deixa isso claro.
- **Formulário sem avaliados vinculados vale para todos.**
- **Finalizada no aparelho não se edita no app**; reenvio de inspeção já finalizada é ignorado pelo servidor (idempotente), nunca sobrescreve.
- **Números** usam algarismos tabulares na fonte normal (a mono do sistema ficou ilegível quando a IBM Plex não carrega offline). Mono só em IDs.

### Desvios do ambiente (não do produto)
- O registro do npm está bloqueado aqui, então **não há Next.js nem Supabase** neste build: é React 19 empacotado pelo Bun, com uma camada de dados falsa (`app/src/data/server.ts`) que tem as **mesmas assinaturas** das rotas do architecture.md. O `/replica-backend` troca só essa camada.
- Sem `@types/react` offline: `app/src/react-shim.d.ts` declara o mínimo para o `tsc` estrito checar todo o código. Apague-o ao instalar as dependências.
- IBM Plex vem do Google Fonts quando há rede; offline cai na fonte do sistema.

### Bugs encontrados pelos testes e corrigidos
1. Publicar ficava desabilitado depois do autosave (o editor só via "alterado" enquanto salvava). Agora compara o rascunho com a versão publicada.
2. Tokens de espaço inexistentes (`--space-16`) invalidavam o padding inteiro da página. Tokens agora são `--space-N = N×4px`.
3. Desligar o modo avião do app não disparava o sync automático.
4. Linha mal formada no `features.csv` do recon (vírgula sem aspas).
5. O Bun grava o bundle ao lado da entrada quando recebe `--outfile` relativo; o build usa `--outdir` absoluto e falha se o arquivo não existir.

## Marco 2 — obrigatórias restantes · 14/10/2026 · concluído no que dá para fazer sem backend

Nenhuma funcionalidade obrigatória está mais em "não": **21 feitas e 10 parciais de 31**. As parciais dependem do backend real (login, e-mail de verdade, multiempresa) ou são detalhes menores listados na matriz.
Testes: `tests/e2e-marco2.mjs` (23 verificações). Suíte inteira (`scripts/test.sh`): 19 do motor + 50 ponta a ponta, verde em 3 rodadas seguidas.

| tela | estado | o que falta | o que foi mais difícil do que parecia |
|---|---|---|---|
| S16 Relatório | parcial | layout configurável (logos, cor, colunas) — marco 3 | — |
| S23 Importar avaliados | feito | — | ler .xlsx sem biblioteca: zip + XML na mão, com textos compartilhados e "rich text" do Excel |
| S24 Histórico de planos | feito | exportar | ordem instável quando dois planos nascem no mesmo milissegundo |
| S25 Modelos de plano | feito | aprovação do plano (marco 3) | — |
| S26 Responder plano (público) | feito | — | o motor só cobra a foto depois da resposta; a página avisa as duas coisas de uma vez |
| E-mails enviados | feito (simulação) | envio real (Resend) no backend | — |

### Decisões tomadas sem confirmação (revisar)
- **Destinatário do plano:** o modelo escolhe entre o e-mail do avaliado ou um e-mail fixo (ex.: manutenção). Sem e-mail, o plano é criado mesmo assim e o gestor gera o link para mandar por outro canal.
- **"Copiar link":** o banco guarda só o hash do token, então o link não pode ser mostrado de novo. "Gerar novo link" cria outro e **invalida o anterior** (o original permite copiar o mesmo link).
- **Modelo editado não muda planos já abertos:** cada plano guarda uma cópia do modelo da época.
- **Importação:** casa por código; sem código, casa por nome igual (sem diferenciar maiúsculas). Linhas com problema são ignoradas e listadas; o resto entra.

### Bugs encontrados pelos testes e corrigidos
1. **Aba nova já logada ficava em branco.** O redirecionamento inicial trocava a URL antes de o roteador começar a escutar. Os testes do marco 1 não pegaram porque sempre abriam numa rota final.
2. **O bundle levava o React de desenvolvimento** (980 KB → 810 KB e mais rápido ao corrigir).
3. Reenviar uma inspeção repetia o evento "relatório enviado" no histórico (o e-mail em si já não repetia).
4. A validação nativa do navegador escondia as nossas mensagens nos campos de e-mail.
5. A página pública numerava a não conformidade errado ("3." em vez de "1.").

## Marco 3 — acesso, agenda, painel e aprovação · 14/10/2026 · concluído no que dá para fazer sem backend

Testes: `tests/e2e-marco3.mjs` (12), `tests/e2e-agenda.mjs` (12), `tests/e2e-painel.mjs` (8), `tests/e2e-aprovacao.mjs` (7) e `app/test/agenda.test.ts` (10 de unidade).
Suíte inteira: 30 de unidade + 88 ponta a ponta, verde.
**Matriz:** must 22 + 9 parciais de 31 · should 10 + 4 de 19 · could 5 + 0 de 19.

| tela | estado | o que falta | o que foi mais difícil do que parecia |
|---|---|---|---|
| S30 Permissões (pessoas e equipes) | feito | convidados externos | sessão e lista de membros precisam ser síncronas nas telas; ficou um cache resolvido no localStorage, renovado a cada gravação |
| S31 Funções | feito | — | o score bar global `.bar` vazou para os gráficos (min-width 220 px); renomeado |
| S05 Agendamentos | feito | exportar | o filtro com atraso deixava o teste clicar na linha errada |
| S06 Agendar | feito | — | término por quantidade conta desde o início, não desde a janela; mês curto no dia 31 |
| S07 Inativar | feito | — | — |
| M09 Agenda no app | parcial | push com o app fechado (Web Push/VAPID, backend) | — |
| Painel | feito | exportar, comparação entre avaliados ao longo do tempo | barras com `calc(% − px)` achatavam diferenças; valor agora fica posicionado na ponta |
| S32 Aprovações + aprovação no S12 | feito | aprovação de plano de ação | quem aprova precisa ver a inspeção mesmo sem acompanhar quem aplicou |
| S15 Configurações → Aprovação | feito | — | — |

### Decisões tomadas sem confirmação (revisar)
- **Acesso efetivo = união** do que foi dado à pessoa e às equipes dela. Equipe nova não amplia nada até ser configurada.
- **Pessoa convidada** começa sem formulários e com todos os avaliados. Quem tem "criar e editar formulários" aplica qualquer um.
- **Dono da conta** é sempre Administrador e não pode ser desativado; ninguém desativa o próprio acesso.
- **Agendamento:** "atrasada" é derivada (2 h depois do horário, ou meia-noite se for o dia inteiro). Ocorrências que já venceram quando o agendamento é criado não nascem. Editar refaz só as futuras pendentes.
- **Inspeção pela agenda** cumpre a ocorrência só se quem aplicou é responsável e formulário/avaliado batem; senão vira avulsa.
- **Aprovação:** etapas ficam congeladas na versão do formulário; em cada etapa qualquer um dos escolhidos decide; ninguém aprova a própria inspeção; reprovar encerra (não volta para correção).
- **Painel** conta inspeções finalizadas, em aprovação, aprovadas e reprovadas; "agenda cumprida" só considera o que já venceu.

### Bugs encontrados pelos testes e corrigidos
1. "Faltam 1 para finalizar" → "Falta 1 questão para finalizar".
2. Gráfico de barras: largura achatada pela regra global `.bar`.
3. Tabela do painel estourava a largura no celular (390 px).
4. "+0 pts vs. anterior" → "igual à anterior"; diferença de nota em p.p.

### Marco 3 (complemento) · 14/10/2026
Preenchimento automático e único, incremento numérico, geolocalização no início/fim e tópico condicional no editor.
Teste: `tests/e2e-campo-extra.mjs` (7). Suíte: 31 de unidade + 95 ponta a ponta.
**Matriz:** must 24 + 7 parciais de 31 · should 12 + 4 de 19 · could 6 + 0 de 19.

**Decisões (revisar):** preenchimento copia escolha, número, texto e data — nunca fotos nem assinatura (senão uma foto antiga satisfaria a "foto obrigatória"). Resposta única é imposta pelo servidor. GPS negado ou sem sinal não impede a inspeção; fica "não registrado".

**Bugs graves achados pelos testes e corrigidos:**
1. **Fórmulas quebravam ao inserir ou mover questões.** Cálculo cita questões por número (`[3] - [4]`); uma questão nova no topo deslocava tudo e o peso líquido passava a subtrair a questão errada. A publicação acusava, mas o gestor não saberia consertar. Agora o editor reescreve as referências a cada mudança; questão excluída vira `[?]` para a validação apontar, em vez de mirar outra questão em silêncio.
2. **Inspeção parada na fila.** Finalizar enquanto o sync de abertura do app ainda rodava fazia o pedido de sync se perder; a inspeção só subia no próximo gatilho (reconectar ou tocar em sincronizar). Agora um pedido que chega durante um sync faz a passada repetir antes de terminar.

### Marco 3 (formulários e planos) · 14/10/2026
S20 importar formulário por planilha, modelos prontos + cópia de formulário, aprovação de plano de ação.
Testes: `app/test/importarFormulario.test.ts` (5) e `tests/e2e-modelos.mjs` (7). Suíte: 36 de unidade + 102 ponta a ponta.

**Decisões (revisar):**
- A planilha usa `;` entre opções. Num CSV com `;` como separador, o Excel já põe aspas nessas células; quem escreve à mão pode usar `|`. Linhas com problema ficam de fora; problema estrutural (detectado pelo motor) bloqueia a criação.
- Os modelos prontos são escritos no mesmo formato da planilha e passam pelo mesmo leitor — um teste garante que todos são válidos.
- Plano devolvido: as respostas recusadas ficam guardadas no histórico do plano, o plano reabre vazio com prazo novo (hoje + prazo do modelo) e o link antigo deixa de valer.

### Marco 3 (relatório e cadastro) · 14/10/2026
S16 layout configurável do PDF e S22 campos personalizados de avaliados (com dependência), usados também na importação e como filtro do painel.
Testes: `app/test/camposAvaliado.test.ts` (3), `tests/e2e-relatorio.mjs` (3, lê o PDF com pdftotext e confere pixels da página), `tests/e2e-campos.mjs` (6). Suíte: 39 de unidade + 111 ponta a ponta.

**Decisões (revisar):**
- **A aparência do PDF segue a última versão publicada**, mesmo para inspeções antigas; o conteúdo continua sendo o da versão em que a inspeção foi feita. Assim, trocar o logo vale para todos os relatórios gerados depois.
- O logo é reduzido no navegador para no máx. 400 px (PNG mantém transparência) e guardado como anexo, não dentro do formulário.
- "Só exceções" mostra não conformes, sem resposta e assinaturas; o resto vira "n questões conformes neste tópico".
- Campo escondido por dependência tem o valor descartado ao salvar. Grafia de lista é corrigida sem diferenciar maiúsculas ("interior" → "Interior").

## 2026-10-14 — backend real (Supabase)

Feito: núcleo único (`nucleo.ts`) usado pelo modo demonstração e pela API; Postgres com RLS fechado; API com checagem de permissão por método; Supabase Auth (convite, recuperação, definir senha); fila de e-mails via Resend com PDF; agenda e envios pelo pg_cron; workflow de publicação e de criação de organização.
Testes: `backend/jobs.test.ts` (6), `tests/api-seguranca.mjs` (9) e as 11 suítes ponta a ponta rodando contra a API real local, além da suíte de demonstração (39 + 111).
Mais difícil que o previsto: o modo real expôs corridas que o falso escondia (lista antiga contada antes de recarregar, aviso da importação anterior ainda na tela) — testes ajustados para esperar o estado certo.
Falta: limite de taxa próprio na API, validação formal por método, anexos no Storage, política de privacidade. Não testado contra um Supabase de verdade (o ambiente daqui não alcança supabase.com) — o primeiro deploy é o teste.

**Decisões (revisar):**
- Uma tabela `registros` em JSONB por organização em vez de uma tabela por entidade: as regras rodam no mesmo código do aparelho e o esquema evolui sem migração. Custo: o estado da organização é carregado inteiro por chamada — ok até alguns milhares de inspeções; depois, quebrar por coleção.
- Cadastro público fechado; organizações nascem pelo workflow "Criar organização".
