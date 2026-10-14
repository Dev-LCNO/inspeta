// Cria uma organização nova no banco. Com demo=true, nasce com os dados de exemplo (para testes e apresentação);
// sem demo, nasce só com as funções padrão e o dono da conta.
import { estadoDemonstracao, criarServidor } from "../app/src/data/nucleo";
import { FUNCOES } from "../app/src/data/seed";
import type { Organizacao } from "../app/src/data/types";
import { ambientePg, anexosNoBanco, estadoVazio, type Sql } from "./repo";

export interface NovaOrg { nome: string; fuso_horario?: string; dono: { nome: string; email: string }; demo?: boolean }

export async function provisionar(sql: Sql, o: NovaOrg, urlApp = ""): Promise<Organizacao> {
  const [row] = await sql<{ id: string }>`insert into orgs (nome, fuso_horario) values (${o.nome}, ${o.fuso_horario ?? "America/Sao_Paulo"}) returning id`;
  const org: Organizacao = { id: row!.id, nome: o.nome, fuso_horario: o.fuso_horario ?? "America/Sao_Paulo" };
  const amb = ambientePg(sql, org, { urlApp, anexos: anexosNoBanco(sql) });
  amb.carregar = async () => undefined; // força o estado inicial na primeira leitura
  amb.estadoInicial = () => {
    if (o.demo) {
      const s = estadoDemonstracao(org);
      const dono = s.membros.find((m) => m.is_master)!;
      dono.nome = o.dono.nome; dono.email = o.dono.email.toLowerCase();
      return s;
    }
    const s = estadoVazio();
    s.funcoes = structuredClone(FUNCOES);
    s.membros = [{ id: crypto.randomUUID(), org_id: org.id, nome: o.dono.nome, email: o.dono.email.toLowerCase(), funcao_id: "fn-admin",
      is_master: true, ativo: true, acesso: { formularios: "todos", avaliados: "todos", ver_membros: [], ver_equipes: [] }, created_at: new Date().toISOString() }];
    return s;
  };
  await criarServidor(amb).listarFuncoes(); // primeira leitura grava o estado inicial
  return org;
}
