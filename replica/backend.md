# Backend real — Supabase + GitHub

## Como está montado

| Peça | Onde | O que faz |
|---|---|---|
| Banco | `supabase/migrations/*.sql` (Postgres do Supabase) | `orgs`, `registros` (uma linha por objeto, JSONB, por organização), `anexos`, `auditoria`, `interno.config`. RLS ligado em tudo **sem nenhuma policy** e `anon`/`authenticated` sem permissão: o navegador não lê nem grava o banco direto, só pela função `api`. |
| Login | Supabase Auth (e-mail e senha) | Cadastro público **fechado** (`disable_signup`); só entra quem foi convidado. Convite e "esqueci minha senha" voltam para `#/definir-senha`. |
| API | `supabase/functions/api` (gerado de `backend/api.ts`) | Um endpoint POST `{metodo, args}`. Confere o token no Supabase Auth, acha a pessoa pelo e-mail, troca qualquer `quem` pelo usuário autenticado, aplica a função/permissão de cada método (`METODOS`) e roda **as mesmas regras do modo demonstração** (`app/src/data/nucleo.ts`). Uma trava por organização (`pg_advisory_xact_lock`) serializa escritas; `client_uuid` único impede inspeção duplicada. Toda escrita vai para `auditoria`. |
| Trabalhos | `supabase/functions/jobs` (de `backend/funcao-jobs.ts` + `backend/jobs.ts`) | A cada minuto (pg_cron → pg_net): envia a fila de e-mails pelo Resend com o PDF do relatório anexado e gera a agenda (a cada 15 min). Também cria organizações (workflow "Criar organização"). Protegida por `x-cron-secret`. |
| App | GitHub Pages | Mesmo PWA; com `INSPETA_API` definido no build ele fala com a API em vez do IndexedDB. Sem essa variável continua sendo a demonstração. |
| Publicação | `.github/workflows/deploy.yml` | A cada push na `main`: migrações, segredos das funções, deploy das funções, configuração do Auth (endereço do app, cadastro fechado, SMTP do Resend), liga o agendador e publica o app. |

Desenvolvimento sem internet: `backend/dev.ts` imita as rotas do Supabase (`/auth/v1`, `/functions/v1/api`) sobre um Postgres local (`backend/scripts/pg-local.sh`).

## Passo a passo para você (uma vez só)

Claude não cria contas nem vê chaves. Tudo abaixo é feito por você, nos painéis oficiais.

1. **Supabase** — supabase.com → New project → nome `inspeta`, região **South America (São Paulo)**. Anote a senha do banco num gerenciador de senhas.
   - Settings → General: copie o **Project ID** (o "ref").
   - Settings → API: copie a chave **anon public**.
   - Account (canto superior) → Access Tokens → gere um token para a CLI.
2. **Resend** (opcional, mas sem ele nenhum e-mail sai e os convites ficam limitados ao e-mail do dono do projeto Supabase) — resend.com → crie uma API key com permissão de envio. Para mandar para qualquer pessoa, verifique um domínio seu (Domains) e use um remetente desse domínio.
3. **GitHub** — crie um repositório **privado** vazio (ex.: `inspeta`) e me diga o nome. Em Settings → Pages → Source escolha **GitHub Actions**.
4. **GitHub → Settings → Secrets and variables → Actions**:
   - aba *Variables*: `SUPABASE_PROJECT_REF`, `SUPABASE_ANON_KEY`, `EMAIL_REMETENTE` (opcional, ex.: `Inspeta <inspecoes@seudominio.com.br>`)
   - aba *Secrets*: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `CRON_SECRET` (invente um texto aleatório de 40+ caracteres), `RESEND_API_KEY` (opcional)
5. Faça o push (ou Actions → Publicar → Run workflow). O primeiro job confere se falta algum valor e diz qual.
6. **Actions → Criar organização → Run workflow** com o nome do cliente e o e-mail de quem administra. Essa pessoa recebe o convite, define a senha e convida o resto da equipe pela tela Pessoas.

Observação: GitHub Pages em repositório privado exige plano pago do GitHub. No plano gratuito, deixe o repositório público (não há segredo no código) ou publique o app em outro host estático — só o job `app` muda.

## Checklist de segurança

- [x] Segredos só em variáveis de ambiente (Secrets do GitHub → `supabase secrets set`); `.env*` no `.gitignore`; o deploy falha se aparecer chave secreta no bundle do app
- [~] Entrada validada no servidor: só métodos da lista `METODOS` são aceitos (internos dão 404), argumentos de identidade são substituídos pelo usuário autenticado e as regras de negócio validam os dados. Sem esquema formal (zod) por método — **pendente**
- [x] Autorização em toda leitura e escrita, testada com segunda pessoa e segunda organização (`tests/api-seguranca.mjs`, 9 checagens)
- [~] Limites de taxa: login, convite e recuperação de senha usam os limites do Supabase Auth. A API e o link público do plano ainda não têm limite próprio — **pendente**
- [x] Webhooks: não há (sem pagamentos)
- [~] Anexos: ficam no banco e só saem pela API, com checagem de acesso. Limite de tamanho no app (fotos reduzidas); falta limite no servidor e mover para Storage em bucket separado — **pendente**
- [x] Sem dados pessoais em URL ou log: o link do plano usa token aleatório (banco guarda só o hash e apaga o link depois do envio); o workflow mascara o e-mail
- [ ] Dependências auditadas: o registro npm não é acessível neste ambiente; rode `npm audit` na sua máquina ou ative o Dependabot no GitHub
- [ ] Política de privacidade listando operadores: Supabase (banco, login, funções — São Paulo), Resend (e-mail), GitHub (hospedagem do app) — **a escrever**
- [ ] Backups: o plano gratuito do Supabase não tem backup diário; no Pro ele vem ligado. Confira em Database → Backups

## Pagamentos

O CLICQ vende por contrato com o comercial, sem assinatura pelo site. Não há Stripe nesta fase; organizações são criadas pelo workflow.

## Testes

```bash
./scripts/test-backend.sh   # Postgres local + API real: jobs.test + api-seguranca + as 11 suítes ponta a ponta
./scripts/test.sh           # modo demonstração (sem backend)
```
