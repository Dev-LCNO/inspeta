// Resolve função + equipes + acessos em um Membro pronto para as telas.
// No backend real isto é a view `membros_efetivos` (union dos acessos da pessoa e das equipes).
import type { Acesso, Equipe, Funcao, ID, Membro, MembroRegistro } from "./types";

const SEM_FUNCAO: Funcao = { id: "", nome: "Sem função", acoes: [] };

function unir(a: ID[] | "todos", b: ID[] | "todos"): ID[] | "todos" {
  if (a === "todos" || b === "todos") return "todos";
  return [...new Set([...a, ...b])];
}

export function resolverMembros(regs: MembroRegistro[], funcoes: Funcao[], equipes: Equipe[]): Membro[] {
  const membrosDa = (eqIds: ID[]) => equipes.filter((e) => eqIds.includes(e.id)).flatMap((e) => e.membros);
  return regs.map((r) => {
    const f = funcoes.find((x) => x.id === r.funcao_id) ?? SEM_FUNCAO;
    const minhas = equipes.filter((e) => e.membros.includes(r.id));
    const acessos: Acesso[] = [r.acesso, ...minhas.map((e) => e.acesso)];
    const formularios = acessos.reduce<ID[] | "todos">((acc, a) => unir(acc, a.formularios), []);
    const avaliados = acessos.reduce<ID[] | "todos">((acc, a) => unir(acc, a.avaliados), []);
    const ve = new Set<ID>();
    for (const a of acessos) {
      for (const id of a.ver_membros) ve.add(id);
      for (const id of membrosDa(a.ver_equipes)) ve.add(id);
    }
    ve.delete(r.id);
    return {
      id: r.id, org_id: r.org_id, nome: r.nome, email: r.email, funcao_id: f.id, funcao: f.nome,
      acoes: r.is_master ? [...new Set([...f.acoes])] : [...f.acoes], is_master: r.is_master, ativo: r.ativo,
      equipes: minhas.map((e) => e.id), formularios_permitidos: formularios, avaliados_permitidos: avaliados,
      ve_inspecoes_de: [...ve],
    };
  });
}

/** Pessoa nova: nenhum formulário até alguém liberar; enxerga todos os avaliados. */
export const ACESSO_PESSOA_NOVA: Acesso = { formularios: [], avaliados: "todos", ver_membros: [], ver_equipes: [] };
/** Equipe nova: não amplia nada até ser configurada. */
export const ACESSO_EQUIPE_NOVA: Acesso = { formularios: [], avaliados: [], ver_membros: [], ver_equipes: [] };
