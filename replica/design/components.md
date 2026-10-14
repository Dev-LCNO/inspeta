# Componentes — especificação

Base: lista de componentes do `recon.md` §4 + o que o uso em campo exige.
Implementação: **shadcn/ui sobre Radix** (acessível de fábrica), ícones **Lucide** (ISC), fonte **IBM Plex Sans/Mono** (OFL).
Nada de ícone, ilustração, texto ou cor da marca original.

## Regras globais

- **Classes só por papel**: `bg-surface`, `text-text-muted`, `border-border-input`, `rounded-md`. Nenhum hex em componente.
- **Cor nunca sozinha**: conforme, NC, N/A, atrasado e classificação sempre trazem **ícone + texto** além da cor. Isso vale para daltônicos e para tela sob sol.
- **Foco visível**: `outline: var(--bw-focus) solid var(--c-focus); outline-offset: 2px` em todo elemento interativo, só no `:focus-visible`.
- **Campo (PWA)**: alvo de toque ≥ 48px (`--touch-min`), opção de resposta com 56px (`--touch-answer`) e 8px entre alvos. Texto de input em 16px, para o iOS não dar zoom. Ações principais ficam na **barra inferior**, ao alcance do polegar.
- **Estados obrigatórios** em todo componente com dados: carregando (skeleton, nunca spinner em tela cheia), vazio (texto + ação), erro (texto + tentar de novo) e offline quando fizer sentido.
- **Movimento**: `--motion-fast` em hover e press, `--motion-base` em drawer e modal; tudo vira 0 com `prefers-reduced-motion`.
- **Textos**: português, voz direta, sem jargão ("Não conforme", não "NC" na interface do aplicador; "NC" só em tabelas do backoffice, com tooltip).

---

## 1. Fundamentos de ação e entrada

```
Button
  variants  primary (accent), secondary (surface + borda), ghost, danger, success
  sizes     sm 32px (só backoffice), md 40px, lg 48px (padrão no app de campo), xl 56px (barra inferior)
  states    default, hover (accent-hover), active (translateY 1px), focus-visible, disabled (text-disabled, sem cursor), loading
  tokens    radius md · font sm/600 (md e acima: base/600) · gap 8px ícone+texto
  a11y      <button> real; loading = aria-busy + rótulo mantido ("Enviando…" lido pelo leitor); ícone sozinho exige aria-label
  used on   todas as telas
```

```
IconButton
  sizes     40px (web), 48px (campo)
  states    como Button; tooltip no hover/foco (web)
  a11y      aria-label obrigatório; tooltip não substitui o label
  used on   S04 ⋮, S14, M06 barra de ações da questão
```

```
TextField / Textarea
  anatomy   label (sempre visível, nunca só placeholder) · input · ajuda · erro
  states    default, hover, focus (borda focus 1.5px + anel), filled, error (borda danger + ícone + mensagem), disabled, read-only
  tokens    altura 40 (web) / 48 (campo) · borda border-input 1.5px · radius md · bg bg · texto base
  a11y      <label for>; erro em aria-describedby + aria-invalid; contador de caracteres com aria-live polite
  variant   com leitor de código: botão de câmera à direita (48px) → abre ScannerSheet
  used on   S01, S06, S10, S14, S21, M06
```

```
NumericField (questão numérica)
  anatomy   label · input numérico grande (font mono, tabular-nums, 20px) · unidade · faixa aceita "entre −2 e 4 °C"
  states    vazio, dentro do limite (borda success + ✓ "Dentro do limite"), fora do limite (borda danger + ⚠ "Fora do limite" + pede observação), inválido
  extra     incremento: botão "Usar anterior +1"; preenchimento automático: chip "Última: 3,5 · usar"
  a11y      inputmode="decimal"; o estado de limite é anunciado em aria-live; nunca bloqueia digitar fora do limite (registra, não impede)
  used on   M06, S10
```

```
Select / Combobox
  variants  select simples (≤ 7 itens), combobox com busca (avaliados, formulários, membros)
  states    fechado, aberto, item ativo, selecionado, vazio ("Nenhum avaliado encontrado"), carregando, disabled, erro
  a11y      Radix Select/Popover + cmdk; setas, Enter, Esc, digitação para pular
  used on   S06, S09, S14, S30, M05
```

```
Checkbox / Radio / Switch
  sizes     20px de controle com área clicável de 44–48px (a linha inteira é clicável)
  states    off, on, indeterminate (checkbox), focus, disabled
  Switch    usado em ToggleRow (abaixo); nunca para enviar algo, só para configuração
  a11y      Radix; Switch com role="switch" e aria-checked
  used on   S15, S16, S17, S22, S30
```

```
ToggleRow (configuração com descrição)
  anatomy   título (sm/600) · descrição (sm, text-muted) · Switch à direita · conteúdo extra quando ligado (ex.: geolocalização → início/fim)
  states    off, on (expande o detalhe com motion-base), disabled com motivo ("Requer cálculo de nota")
  a11y      o Switch é rotulado pelo título e descrito pela descrição
  used on   S15, S16, S18
```

```
DateTimeField
  variants  data, data+hora, horários múltiplos (chips "07:00 ×  15:00 ×  + horário")
  a11y      input nativo type=date/time no celular (teclado do sistema); no web, calendário Radix com teclado
  used on   S04 filtros, S06, M06
```

```
FileUpload
  variants  dropzone (web), botão "Escolher arquivo" (campo), logo (preview quadrado)
  states    vazio, arrastando (borda accent tracejada), enviando (barra de progresso real), concluído (nome + tamanho + remover), erro (tipo/tamanho, mensagem com o limite: "Máx. 15 MB")
  a11y      input file real e oculto, acionado pelo botão; progresso com role="progressbar"
  used on   S15, S16, S20, S23, M06
```

```
ColorPicker
  anatomy   quadrado de cor 32px + popover com 12 cores pré-definidas + hex
  regra     ao escolher cor de classificação ou de status, mostra a prévia do badge e avisa se o contraste com o texto ficar < 4.5
  used on   S15, S16, S28
```

## 2. Navegação e estrutura (backoffice)

```
AppShell / Sidebar
  widths    248px expandida · 64px recolhida (só ícones + tooltip) · drawer em < lg
  itens     Inspeções · Formulários · Avaliados · Planos de ação · Workflows · Permissões · Funções · Painel
  states    item default, hover (surface-2), ativo (accent-soft + barra 3px accent à esquerda + texto accent), badge de contagem (aprovações pendentes)
  header    56px: seletor de organização, busca global (⌘K), avatar
  a11y      <nav aria-label="Principal">; item ativo com aria-current="page"; drawer com foco preso e Esc
  used on   S03 (todas web)
```

```
Tabs
  variants  sublinhado (páginas: Histórico | Agendamentos), segmentado (editor: Questões | Configurações | Relatório | Avaliados)
  a11y      Radix Tabs; setas trocam a aba; URL reflete a aba (?aba=agendamentos)
  used on   S04/S05, S14–S17, S24/S25, S30
```

```
PageHeader
  anatomy   título (xl) · descrição curta · ações à direita (primária por último)
  used on   todas web
```

## 3. Dados

```
DataTable
  anatomy   FilterBar · tabela · paginação (25/50/100) · ações em lote quando houver seleção
  colunas   ordenáveis (seta + aria-sort); números à direita em tabular-nums; datas no fuso da org
  linha     altura 48px; clique abre detalhe; menu ⋮ no final (DropdownMenu)
  states    carregando (5 linhas skeleton), vazio sem filtro (EmptyState com ação "+ Nova inspeção"), vazio com filtro ("Nenhum resultado para esses filtros" + "Limpar filtros"), erro, seleção
  mobile    < md vira lista de cards (título, status, 2 metadados)
  a11y      <table> semântica; linha clicável também acessível por um link no primeiro campo
  used on   S04 S05 S13 S21 S24 S27 S29 S30
```

```
FilterBar
  anatomy   busca (debounce 300ms) · intervalo de datas · "Filtros" (popover coluna + valor, chips removíveis) · "Limpar"
  regra     filtros vão para a URL (compartilhável e sobrevive ao F5)
  used on   S04 S05 S24
```

```
StatusBadge
  variants  rascunho (na) · completa (success) · em aprovação (warning) · aprovada (success, ícone selo) · reprovada (danger)
            pendente (na) · atrasada (danger, ícone relógio) · inativa (text-disabled, riscado não, só cinza)
            aberto (accent) · em atraso (danger) · finalizado (success)
            custom (workflow: cor do usuário, texto escolhido automaticamente por contraste)
  forma     pill, altura 24px, xs/600, ícone 14px + texto. Fundo *-soft + texto na cor cheia
  a11y      o texto é o estado; ícone aria-hidden
  used on   S04 S05 S12 S24 S29 M08
```

```
ScoreBadge / ScoreHero
  Badge     "86,5% · Bom" com bolinha da cor da classificação; mono tabular
  Hero      nota grande (display, mono) + classificação + barra horizontal da nota com as faixas desenhadas atrás + "anterior: 78,0%" e seta ↑/↓
  states    sem nota (formulário sem cálculo) = esconde; oculta durante a aplicação = "Nota disponível ao finalizar"
  a11y      texto completo para leitor: "Nota 86,5 por cento, classificação Bom, subiu 8,5 pontos"
  used on   S04 S12 S11 M06 (prévia) M11
```

```
EmptyState
  anatomy   ícone Lucide 32px text-muted · título (lg) · uma frase · uma ação primária
  regra     escrito para a tela ("Nenhum formulário ainda. Crie o primeiro para começar a inspecionar.") — nunca "Sem dados"
  used on   todas as listas, M04 ("Sincronize para baixar seus questionários")
```

```
Skeleton
  regra     mesma forma do conteúdo final; pulsa com motion-base; sem pulsar com reduced-motion
```

## 4. Sobreposições e feedback

```
Dialog (Modal)
  variants  formulário (S06 Agendar), confirmação, perigo (Excluir: botão danger + nome do item no texto)
  sizes     sm 400 · md 560 · lg 720; em < md vira sheet de baixo, tela cheia
  a11y      Radix Dialog: foco preso, Esc fecha (exceto com alterações não salvas → confirma), foco volta ao gatilho
  used on   S06 S07 S11 S18 S20 S23 S32
```

```
Sheet (bottom sheet, campo)
  uso       ações da questão no celular (foto, comentário, ajuda, anexo), escolha com > 3 opções, tópicos
  a11y      como Dialog; alça arrastável é decorativa, botão "Fechar" existe
  used on   M06 M07 M10
```

```
DropdownMenu (⋮)
  itens     ícone + texto; item destrutivo em danger e separado por divisor no fim
  a11y      Radix; setas, Enter, Esc
```

```
Toast
  variants  success, error (com ação "Tentar de novo"), info, sync ("3 inspeções enviadas")
  posição   web: canto inferior direito · campo: acima da barra inferior
  tempo     4s; erro fica até fechar
  a11y      role="status" (info/sucesso) ou "alert" (erro); pausa no hover/foco
```

```
Callout (inline)
  variants  info, warning, danger, success
  uso       "Esta inspeção tem 2 não conformidades. Planos de ação serão enviados ao finalizar."; aviso de versão nova do formulário
```

## 5. Específicos do app de campo (o coração do produto)

```
QuestionCard
  anatomy   número + título (md) · ajuda (ícone "?" 48px se houver) · campo de resposta · ReincidenceTag · barra de ações · área de NC
  states    não respondida, respondida, obrigatória pendente (borda danger 2px + "Obrigatória" — só depois de tentar avançar), não conforme (fundo danger-soft, exige o que estiver configurado), escondida por dependência (não renderiza), somente leitura (preenchimento único)
  a11y      <fieldset> com <legend> = título; erros ligados por aria-describedby
  used on   M06 S10
```

```
AnswerOption (escolha simples/múltipla)
  layout    ≤ 3 opções: botões empilhados de largura total, 56px; > 3: lista em Sheet com busca
  states    default (bg + borda border-input), pressionado, selecionado conforme (success-soft + borda success 2px + ✓), selecionado não conforme (danger-soft + borda danger 2px + ✕), selecionado N/A (na-soft + "—"), neutro sem regra (accent-soft + borda accent)
  múltipla  checkbox à esquerda; simples: radio
  a11y      radiogroup / group de checkbox reais; o rótulo inclui o estado ("Sim, não conforme")
  used on   M06 S10
```

```
NCPanel (aparece quando a resposta é não conforme)
  anatomy   "Não conforme" + o que falta: [Observação obrigatória] [Foto obrigatória] com chips vermelhos que ficam verdes quando atendidos · "Gera plano de ação: Corrigir validade"
  a11y      lista de pendências anunciada em aria-live polite
```

```
ReincidenceTag
  variants  anterior conforme (✓ success "Última: conforme") · anterior NC (↺ danger "Repetiu NC" quando a atual também é NC; "Última: não conforme" antes de responder) · sem histórico ("—" na "Sem resposta anterior")
  offline   mostra "Histórico indisponível offline" quando o pacote não tem o dado
```

```
QuestionActionBar
  ações     📷 Foto (badge com contagem) · 💬 Comentário · 📎 Anexo · ▦ Ler código · ? Ajuda
  tamanho   botões 48px com rótulo curto embaixo (xs) — ícone sozinho não basta com luva/sol
```

```
PhotoStrip
  anatomy   miniaturas 72px, "+" para adicionar, toque abre visualizador com excluir
  states    enviando (anel de progresso na miniatura), na fila offline (ícone nuvem riscada), enviada, erro (tocar para reenviar)
  regra     compressão no aparelho antes de salvar (≤ 1600px)
```

```
SignaturePad
  anatomy   área 16:9 com linha-guia, "Limpar", "Usar foto", "Salvar"
  regra     gira para paisagem sugerido; traço 2.5px text
  a11y      alternativa "Usar foto" ou nome digitado para quem não consegue desenhar
  used on   M07 S10
```

```
TopicNav (barra inferior da aplicação)
  anatomy   [‹ Anterior]  "Tópico 2 de 5 · 7/12"  [Próximo ›]; no último tópico, Próximo vira "Revisar e finalizar"
  extra     botão "Tópicos" abre Sheet com a lista: ✓ completo, • em andamento, ! obrigatória pendente
  tokens    altura 72px, shadow bar, bg bg, safe-area-inset-bottom
```

```
SyncIndicator
  variants  online e em dia (✓ "Sincronizado há 2 min") · enviando (setas girando "Enviando 2 de 5") · offline com fila (nuvem riscada "3 aguardando internet") · erro ("Falha ao enviar · tocar para ver")
  onde      topo da Home (M02) e no topo da tela de aplicação (compacto)
  a11y      mudanças em aria-live polite (sem anunciar a cada segundo)
```

```
ScannerSheet
  anatomy   câmera em tela cheia, moldura central, lanterna, "Digitar código"
  states    pedindo permissão (explica por quê antes do prompt do sistema), negado ("Ative a câmera nas configurações" + digitar), lendo, lido (vibração curta + valor)
  used on   M10, campos com leitura de código
```

## 6. Específicos do backoffice

```
FormBuilder (S14)
  layout    3 colunas em ≥ lg: árvore de conteúdo 260px · canvas de questões (form-max 760) · painel de configuração 320px; em < lg o painel vira drawer
  QuestionBlock  states: não selecionado, selecionado (borda accent 2px), arrastando (shadow pop + placeholder tracejado), com erro de validação (ícone ! + motivo no painel)
  a11y      reordenar também por teclado (botões "Mover para cima/baixo" no menu); arrastar é atalho, não o único jeito
  autosave  "Salvo há 5 s" no header; publicar é ação explícita com resumo das mudanças
```

```
ScoreRuleEditor (S18)
  opções    tabela opção | pontos | conforme (✓/✕/—) | desconto % | escopo
  faixas    lista "até [valor] → [pontos]" com última faixa "acima"; campos que cruzariam faixas ficam desabilitados com dica
```

```
ClassificationRange (S15)
  anatomy   barra 0–100 com N segmentos coloridos e alças arrastáveis + linhas editáveis (nome, cor, de, até)
  a11y      alças são sliders Radix (setas ±1, PageUp ±10); os campos numéricos são o caminho principal
```

```
RecurrencePicker (S06)
  anatomy   Repetir: [Não | Diário | Semanal | Mensal] · dias da semana (chips D S T Q Q S S, 48px) · Termina: [Nunca | Em data | Após N]
  resumo    frase gerada: "Toda segunda e quinta às 07:00 e 15:00, até 31/12/2026"
```

```
ColumnMapper (S23)
  anatomy   linhas: coluna da planilha (com 3 valores de exemplo) → Select do campo do sistema; "Ignorar" disponível
  states    mapeado, obrigatório faltando (danger), sugestão automática por nome (accent-soft "Sugerido")
```

```
PermissionMatrix (S31)
  anatomy   linhas = ações, colunas = funções, células = checkbox; cabeçalho fixo
  a11y      grid com navegação por setas; cada checkbox rotulado "Aplicador pode Aplicar formulários"
```

```
WorkflowCanvas (S28 — fase 3)
  base      React Flow (MIT)
  nós       Início (accent), Formulário (surface + borda), Condição (losango warning), Status (pill com a cor do status)
  a11y      lista textual equivalente ao lado do canvas ("Visão em lista") editável por teclado
```

---

## Mapa componente → tela

| componente | telas |
|---|---|
| AppShell, PageHeader | S03–S32 |
| DataTable, FilterBar, StatusBadge | S04 S05 S13 S21 S24 S27 S29 S30 |
| Dialog | S06 S07 S11 S18 S20 S23 S32 |
| FormBuilder, ScoreRuleEditor, ClassificationRange, ToggleRow | S14–S18 |
| ColumnMapper, FileUpload | S20 S23 |
| RecurrencePicker, DateTimeField | S05 S06 |
| PermissionMatrix | S30 S31 |
| QuestionCard, AnswerOption, NumericField, NCPanel, ReincidenceTag, QuestionActionBar, PhotoStrip, TopicNav | S10 M06 |
| SignaturePad | S10 M07 |
| SyncIndicator, EmptyState | M02 M03 M04 M08 |
| ScannerSheet | M10 |
| ScoreBadge / ScoreHero | S04 S11 S12 M06 M11 |
