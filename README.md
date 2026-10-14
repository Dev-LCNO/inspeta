# Inspeta (nome provisório)

Checklists de qualidade para a cadeia de alimentos que funcionam sem internet.
Reconstrução clean-room das funcionalidades do CLICQ (PariPassu) a partir de fontes públicas — ver `replica/`.

## Rodar

```bash
./scripts/build.sh                     # checa tipos e contraste, gera app/dist
cd app/dist && python3 -m http.server 4173
# abra http://localhost:4173  ·  gestor: rogerio@exemplo.com · aplicadora: ana@exemplo.com · senha: 4+ caracteres
```

## Testar

```bash
./scripts/test.sh                      # motor (19) + build + ponta a ponta (27)
```

## Estrutura

- `packages/form-engine` — nota, desconto, faixas, conformidade, dependências, cálculo seguro, validação. Roda igual no aparelho e no servidor.
- `app/src/data` — `server.ts` (servidor falso com as assinaturas da API real), `device.ts` (aparelho + fila offline), `kv.ts` (IndexedDB).
- `app/src/web` — backoffice. `app/src/field` — app de campo (PWA).
- `replica/` — recon, arquitetura, schema SQL testado, design system, matriz e registro de construção.
