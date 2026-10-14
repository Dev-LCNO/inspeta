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
