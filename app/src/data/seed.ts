// Dados de exemplo — textos escritos para este produto (nenhum vem do original).
import type { FormDefinition } from "@app/form-engine";
import type { Acao, Acesso, Agendamento, Avaliado, Equipe, Formulario, FormularioVersao, Funcao, MembroRegistro, Organizacao, PlanoModelo } from "./types";

export const ORG: Organizacao = { id: "org-1", nome: "Distribuidora Exemplo", fuso_horario: "America/Rio_Branco" };

export const TODAS_ACOES: Acao[] = [
  "gerenciar_formularios", "aplicar", "editar_inspecao", "excluir_inspecao", "ver_todas_inspecoes",
  "gerenciar_avaliados", "gerenciar_planos", "gerenciar_agendamentos", "gerenciar_workflows",
  "gerenciar_permissoes", "aprovar", "ver_painel",
];

export const FUNCOES: Funcao[] = [
  { id: "fn-admin", nome: "Administrador", acoes: TODAS_ACOES, sistema: true },
  { id: "fn-qualidade", nome: "Analista de qualidade", acoes: ["gerenciar_formularios", "aplicar", "editar_inspecao", "ver_todas_inspecoes", "gerenciar_avaliados", "gerenciar_planos", "aprovar", "ver_painel"] },
  { id: "fn-supervisor", nome: "Supervisor de lojas", acoes: ["aplicar", "ver_painel"] },
  { id: "fn-aplicador", nome: "Aplicador", acoes: ["aplicar"] },
];

const LIVRE: Acesso = { formularios: "todos", avaliados: "todos", ver_membros: [], ver_equipes: [] };
const criado = "2026-09-01T12:00:00.000Z";

export const MEMBROS_REG: MembroRegistro[] = [
  { id: "m-rogerio", org_id: ORG.id, nome: "Rogério Marinho", email: "rogerio@exemplo.com", funcao_id: "fn-admin", is_master: true, ativo: true, acesso: LIVRE, created_at: criado },
  { id: "m-ana", org_id: ORG.id, nome: "Ana Paula Souza", email: "ana@exemplo.com", funcao_id: "fn-aplicador", is_master: false, ativo: true,
    acesso: { formularios: ["f-flv"], avaliados: "todos", ver_membros: [], ver_equipes: [] }, created_at: criado },
  { id: "m-carlos", org_id: ORG.id, nome: "Carlos Eduardo Lima", email: "carlos@exemplo.com", funcao_id: "fn-supervisor", is_master: false, ativo: true,
    acesso: { formularios: ["f-flv"], avaliados: ["a-bosque", "a-centro"], ver_membros: [], ver_equipes: ["eq-lojas"] }, created_at: criado },
];

export const EQUIPES: Equipe[] = [
  { id: "eq-lojas", org_id: ORG.id, nome: "Equipe de lojas", membros: ["m-ana"], acesso: { formularios: [], avaliados: [], ver_membros: [], ver_equipes: [] } },
];

const now = "2026-10-01T12:00:00.000Z";
const av = (id: string, nome: string, codigo: string, endereco: string, email?: string): Avaliado => ({
  id, org_id: ORG.id, nome, codigo_externo: codigo, endereco, email, ativo: true, created_at: now, updated_at: now,
});

export const AVALIADOS: Avaliado[] = [
  av("a-bosque", "Loja 01 — Bosque", "LJ01", "Av. Ceará, 1500 — Bosque", "gerencia.lj01@exemplo.com"),
  av("a-centro", "Loja 02 — Centro", "LJ02", "Rua Marechal Deodoro, 210 — Centro", "gerencia.lj02@exemplo.com"),
  av("a-doca3", "CD — Doca 3", "CD03", "Estrada do Aeroporto, km 3"),
];

const CLASSES = [
  { nome: "Ruim", cor: "rank-bad", min: 0, max: 69.99 },
  { nome: "Regular", cor: "rank-mid", min: 70, max: 84.99 },
  { nome: "Bom", cor: "rank-good", min: 85, max: 100 },
];

const sn = (key: string, titulo: string, extra: Record<string, unknown> = {}) => ({
  key, titulo, tipo: "escolha_simples" as const, obrigatoria: true,
  opcoes: [
    { key: `${key}-sim`, texto: "Sim", pontos: 10, conforme: true },
    { key: `${key}-nao`, texto: "Não", pontos: 0, conforme: false },
    { key: `${key}-na`, texto: "Não se aplica", na: true },
  ],
  ...extra,
});

export const DEF_FLV: FormDefinition = {
  config: { calcular_nota: true, casas_decimais: 1, classificacoes: CLASSES, geo: "off", reincidencia_meses: 3, relatorio: { emails: { avaliado: true, extras: ["qualidade@exemplo.com"] } } },
  topicos: [
    {
      key: "t-venda", titulo: "Área de venda",
      questoes: [
        {
          key: "q-vencidos", titulo: "A área de venda está livre de produtos vencidos?", tipo: "escolha_simples", obrigatoria: true,
          ajuda: { texto: "Confira pelo menos 3 lotes por bancada. Etiqueta ilegível conta como vencido." },
          nc_exige: { foto: true, observacao: true },
          plano_acao_modelo_id: "pm-retirada",
          opcoes: [
            { key: "q-vencidos-sim", texto: "Sim, nada vencido", pontos: 10, conforme: true },
            { key: "q-vencidos-nao", texto: "Não, encontrei vencidos", pontos: 0, conforme: false, desconto: { pct: 50, escopo: "topico" } },
          ],
        },
        sn("q-preco", "Todos os itens da bancada têm preço visível?", { nc_exige: { observacao: true } }),
        {
          key: "q-gondola", titulo: "Condição das bancadas", tipo: "escolha_multipla", obrigatoria: true,
          opcoes: [
            { key: "q-gondola-limpa", texto: "Limpas", pontos: 5, conforme: true },
            { key: "q-gondola-abastecida", texto: "Abastecidas", pontos: 5, conforme: true },
            { key: "q-gondola-avaria", texto: "Com produto avariado à mostra", pontos: 0, conforme: false },
          ],
        },
      ],
    },
    {
      key: "t-frio", titulo: "Câmara fria",
      questoes: [
        {
          key: "q-temp", titulo: "Temperatura da câmara fria", tipo: "numerica", obrigatoria: true,
          numerica: {
            formato: "decimal", unidade: "°C",
            limite: { min: -2, max: 4, obs_obrigatoria: true },
            faixas_nota: [{ ate: 4, pontos: 10 }, { ate: 7, pontos: 5 }, { ate: null, pontos: 0 }],
          },
          foto_obrigatoria: true,
          ajuda: { texto: "Leia o termômetro da porta e tire foto do visor." },
        },
        sn("q-porta", "A porta da câmara veda sem frestas?", { plano_acao_modelo_id: "pm-manutencao" }),
        {
          key: "q-porta-motivo", titulo: "O que está causando a fresta?", tipo: "texto",
          obrigatoria: true, depende_de: { questao: "q-porta", opcao: "q-porta-nao" },
        },
      ],
    },
    {
      key: "t-fim", titulo: "Encerramento",
      questoes: [
        { key: "q-obs", titulo: "Observações gerais", tipo: "texto" },
        { key: "q-ass", titulo: "Assinatura do responsável pela loja", tipo: "assinatura", obrigatoria: true },
      ],
    },
  ],
};

export const DEF_RECEB: FormDefinition = {
  config: { calcular_nota: true, casas_decimais: 1, classificacoes: CLASSES },
  topicos: [
    {
      key: "r-doc", titulo: "Documentação",
      questoes: [
        { key: "r-nf", titulo: "Número da nota fiscal", tipo: "texto", obrigatoria: true, texto: { leitura_codigo: true } },
        sn("r-lacre", "O lacre do baú chegou intacto?", { nc_exige: { foto: true } }),
      ],
    },
    {
      key: "r-peso", titulo: "Conferência de peso",
      questoes: [
        { key: "r-bruto", titulo: "Peso bruto da amostra", tipo: "numerica", obrigatoria: true, numerica: { formato: "decimal", unidade: "kg" } },
        { key: "r-tara", titulo: "Tara da caixa", tipo: "numerica", obrigatoria: true, numerica: { formato: "decimal", unidade: "kg" } },
        { key: "r-liq", titulo: "Peso líquido", tipo: "calculo", calculo: { formula: "[3] - [4]", valor_se_vazio: 0 } },
        {
          key: "r-temp", titulo: "Temperatura do produto na chegada", tipo: "numerica", obrigatoria: true,
          numerica: { formato: "decimal", unidade: "°C", limite: { max: 7, obs_obrigatoria: true }, faixas_nota: [{ ate: 7, pontos: 10 }, { ate: null, pontos: 0 }] },
        },
      ],
    },
  ],
};

export const FORMULARIOS: Formulario[] = [
  { id: "f-flv", org_id: ORG.id, nome: "Checklist FLV e perecíveis", rascunho: DEF_FLV, versao_publicada_id: "fv-flv-1", avaliados_vinculados: ["a-bosque", "a-centro"], arquivado: false, created_at: now, updated_at: now },
  { id: "f-receb", org_id: ORG.id, nome: "Recebimento de refrigerados", rascunho: DEF_RECEB, versao_publicada_id: "fv-receb-1", avaliados_vinculados: ["a-doca3"], arquivado: false, created_at: now, updated_at: now },
];

export const VERSOES: FormularioVersao[] = [
  { id: "fv-flv-1", formulario_id: "f-flv", numero: 1, definicao: DEF_FLV, publicado_em: now, publicado_por: "m-rogerio" },
  { id: "fv-receb-1", formulario_id: "f-receb", numero: 1, definicao: DEF_RECEB, publicado_em: now, publicado_por: "m-rogerio" },
];

// Uma inspeção anterior na Loja 01 com produtos vencidos, para a reincidência aparecer.
export const HISTORICO = [
  {
    client_uuid: "seed-0001", formulario_id: "f-flv", formulario_versao_id: "fv-flv-1", avaliado_id: "a-bosque",
    responsavel_id: "m-ana", iniciada_em: "2026-10-06T11:05:00.000Z", finalizada_em: "2026-10-06T11:31:00.000Z",
    respostas: {
      "q-vencidos": { opcoes: ["q-vencidos-nao"], fotos: 1, observacao: "Iogurte natural lote 0921 vencido em 04/10." },
      "q-preco": { opcoes: ["q-preco-sim"] },
      "q-gondola": { opcoes: ["q-gondola-limpa", "q-gondola-abastecida"] },
      "q-temp": { numero: 3.2, fotos: 1 },
      "q-porta": { opcoes: ["q-porta-sim"] },
      "q-ass": { assinatura: "seed" },
    },
  },
  {
    client_uuid: "seed-0002", formulario_id: "f-receb", formulario_versao_id: "fv-receb-1", avaliado_id: "a-doca3",
    responsavel_id: "m-rogerio", iniciada_em: "2026-10-09T09:40:00.000Z", finalizada_em: "2026-10-09T09:52:00.000Z",
    respostas: {
      "r-nf": { texto: "000.481.233" }, "r-lacre": { opcoes: ["r-lacre-sim"] },
      "r-bruto": { numero: 12.4 }, "r-tara": { numero: 0.6 }, "r-temp": { numero: 8.5, observacao: "Caminhão chegou com o baú aberto." },
    },
  },
];

export const PLANOS_MODELO: PlanoModelo[] = [
  {
    id: "pm-retirada", org_id: ORG.id, nome: "Retirada e descarte", agrupamento: "por_inspecao", prazo_dias: 1,
    destinatario: "avaliado", created_at: now, updated_at: now,
    definicao: { config: { calcular_nota: false }, topicos: [{ key: "pr-t", titulo: "Correção", questoes: [
      { key: "pr-acao", titulo: "O que foi feito com os produtos?", tipo: "texto", obrigatoria: true, foto_obrigatoria: true,
        ajuda: { texto: "Descreva a retirada e anexe foto da área já corrigida." } },
      { key: "pr-causa", titulo: "Qual foi a causa?", tipo: "escolha_simples", obrigatoria: true, opcoes: [
        { key: "pr-causa-ronda", texto: "Faltou ronda de validade" },
        { key: "pr-causa-fefo", texto: "Reposição fora do PVPS/FEFO" },
        { key: "pr-causa-etq", texto: "Etiqueta ilegível" },
        { key: "pr-causa-outra", texto: "Outra" },
      ] },
      { key: "pr-quem", titulo: "Quem fez a correção?", tipo: "texto", obrigatoria: true },
    ] }] },
  },
  {
    id: "pm-manutencao", org_id: ORG.id, nome: "Manutenção corretiva", agrupamento: "por_nc", prazo_dias: 5,
    destinatario: "fixo", email_fixo: "manutencao@exemplo.com", created_at: now, updated_at: now,
    definicao: { config: { calcular_nota: false }, topicos: [{ key: "pm-t", titulo: "Manutenção", questoes: [
      { key: "pm-os", titulo: "Número da ordem de serviço", tipo: "texto", obrigatoria: true },
      { key: "pm-data", titulo: "Data prevista para o conserto", tipo: "data_hora", data_hora: { campos: "data" }, obrigatoria: true },
      { key: "pm-obs", titulo: "Observações", tipo: "texto" },
    ] }] },
  },
];

/** Agendamentos de exemplo, relativos a "hoje" (a data é passada na criação do estado). */
export function agendamentosIniciais(hoje: string): Agendamento[] {
  const base = { org_id: ORG.id, fuso_horario: ORG.fuso_horario, ativo: true, materializado_ate: null, criado_por: "m-rogerio", created_at: now, updated_at: now };
  return [
    { ...base, id: "ag-flv-centro", formulario_id: "f-flv", avaliado_id: "a-centro", responsaveis: ["m-ana"], data_inicio: hoje,
      horarios: [], dia_inteiro: true, recorrencia: "diaria", termino: "nunca" },
    { ...base, id: "ag-receb-doca", formulario_id: "f-receb", avaliado_id: "a-doca3", responsaveis: ["m-rogerio"], data_inicio: hoje,
      horarios: ["07:30"], dia_inteiro: false, recorrencia: "semanal", dias_semana: [1, 3, 5], termino: "nunca" },
  ];
}
