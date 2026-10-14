# Inspeta (nome provisório)

Checklists de qualidade para a cadeia de alimentos que funcionam sem internet.
Reconstrução clean-room das funcionalidades do CLICQ (PariPassu) a partir de fontes públicas — ver `replica/`.

## Rodar

```bash
./scripts/build.sh                     # checa tipos e contraste, gera app/dist
cd app/dist && python3 -m http.server 4173
# abra http://localhost:4173 · senha: qualquer uma com 4+ caracteres
# dono da conta: rogerio@exemplo.com · supervisor (aprova, vê a equipe): carlos@exemplo.com · aplicadora: ana@exemplo.com
```

## Testar

```bash
./scripts/test.sh                      # unidade (30) + build + ponta a ponta (88)
```

## Estrutura

- `packages/form-engine` — nota, desconto, faixas, conformidade, dependências, cálculo seguro, validação. Roda igual no aparelho e no servidor.
- `app/src/data` — `server.ts` (servidor falso com as assinaturas da API real), `device.ts` (aparelho + fila offline), `kv.ts` (IndexedDB), `acesso.ts` (função + equipes → acesso efetivo), `agenda.ts` (recorrência e fuso).
- `app/src/web` — backoffice. `app/src/field` — app de campo (PWA).
- `replica/` — recon, arquitetura, schema SQL testado, design system, matriz e registro de construção.

No Painel, o dono da conta pode gerar 12 semanas de inspeções de exemplo (marcadas `demo`) para ver os gráficos com dados.
