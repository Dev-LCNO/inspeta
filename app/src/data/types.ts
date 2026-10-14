// Tipos de domínio — espelham replica/schema.sql (nomes em português, como no banco).
import type { Answers, Evaluation, FormDefinition } from "@app/form-engine";

export type ID = string;
export type ISO = string; // timestamptz em UTC

export type Acao =
  | "gerenciar_formularios" | "aplicar" | "editar_inspecao" | "excluir_inspecao"
  | "ver_todas_inspecoes" | "gerenciar_avaliados" | "gerenciar_planos"
  | "gerenciar_agendamentos" | "gerenciar_workflows" | "gerenciar_permissoes"
  | "aprovar" | "ver_painel";

export interface Organizacao { id: ID; nome: string; fuso_horario: string }

export interface Membro {
  id: ID;
  org_id: ID;
  nome: string;
  email: string;
  funcao: string;
  acoes: Acao[];
  is_master: boolean;
  formularios_permitidos: ID[] | "todos";
}

export interface Avaliado {
  id: ID;
  org_id: ID;
  nome: string;
  codigo_externo?: string;
  documento?: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  ativo: boolean;
  created_at: ISO;
  updated_at: ISO;
}

export interface Formulario {
  id: ID;
  org_id: ID;
  nome: string;
  rascunho: FormDefinition;
  versao_publicada_id: ID | null;
  avaliados_vinculados: ID[]; // vazio = vale para todos
  arquivado: boolean;
  created_at: ISO;
  updated_at: ISO;
}

export interface FormularioVersao {
  id: ID;
  formulario_id: ID;
  numero: number;
  definicao: FormDefinition;
  publicado_em: ISO;
  publicado_por: ID;
}

export type InspecaoStatus = "rascunho" | "completa" | "em_aprovacao" | "aprovada" | "reprovada";

export interface AnexoMeta {
  client_uuid: string;
  questao_key: string | null;
  tipo: "foto" | "assinatura" | "documento";
  mime: string;
  bytes: number;
}

export interface Inspecao {
  id: ID;
  org_id: ID;
  client_uuid: string;
  formulario_id: ID;
  formulario_versao_id: ID;
  avaliado_id: ID;
  responsavel_id: ID;
  status: InspecaoStatus;
  iniciada_em: ISO;
  finalizada_em: ISO | null;
  geo_inicio?: { lat: number; lng: number } | null;
  geo_fim?: { lat: number; lng: number } | null;
  respostas: Answers;
  anexos: AnexoMeta[];
  // calculado no SERVIDOR com o mesmo form-engine (fonte da verdade)
  nota_pct: number | null;
  pontos: number | null;
  pontos_max: number | null;
  classificacao: string | null;
  classificacao_cor: string | null;
  qtd_nao_conformidades: number;
  resultado: Pick<Evaluation, "nao_conformidades"> & {
    questoes: Record<string, { conforme: boolean | null; pontos: number | null; pontos_max: number | null; reincidente: boolean; valor_calculado?: number | null }>;
    topicos: Record<string, { pct: number | null; desconto_pct: number }>;
  };
  device_id: string | null;
  sincronizada_em: ISO;
  created_at: ISO;
  updated_at: ISO;
}

export interface InspecaoEvento {
  id: number;
  inspecao_id: ID;
  membro_id: ID | null;
  acao: "criada" | "sincronizada" | "finalizada" | "editada" | "reaberta" | "relatorio_enviado" | "excluida";
  dados: Record<string, unknown>;
  em: ISO;
}

// ---- planos de ação ----

export interface PlanoModelo {
  id: ID;
  org_id: ID;
  nome: string;
  definicao: FormDefinition; // as perguntas que o responsável responde (por não conformidade)
  agrupamento: "por_inspecao" | "por_nc";
  prazo_dias: number;
  destinatario: "avaliado" | "fixo";
  email_fixo?: string;
  created_at: ISO;
  updated_at: ISO;
}

export type PlanoStatus = "aberto" | "finalizado";
export type PlanoSituacao = PlanoStatus | "em_atraso";

export interface PlanoAcao {
  id: ID;
  org_id: ID;
  modelo_id: ID;
  modelo_snapshot: Pick<PlanoModelo, "nome" | "definicao">;
  inspecao_id: ID;
  avaliado_id: ID;
  formulario_id: ID;
  questao_keys: string[];
  responsavel_email: string | null;
  token_hash: string;
  prazo: string; // yyyy-mm-dd no fuso da organização
  status: PlanoStatus;
  /** respostas por não conformidade: questao_key da NC -> respostas do plano */
  respostas: Record<string, Answers>;
  anexos: (AnexoMeta & { nc_key: string })[];
  respondido_por?: string;
  finalizado_em: ISO | null;
  ultimo_email_em: ISO | null;
  created_at: ISO;
  updated_at: ISO;
}

export interface EmailSaida {
  id: ID;
  idem_key: string;
  para: string;
  assunto: string;
  texto: string;
  link?: string;
  anexo?: { tipo: "relatorio_pdf"; inspecao_id: ID };
  status: "enviado" | "sem_destinatario";
  criado_em: ISO;
}

export interface LinhaImportacao {
  nome?: string;
  codigo_externo?: string;
  documento?: string;
  email?: string;
  telefone?: string;
  endereco?: string;
}

export interface ResultadoImportacao {
  novos: number;
  atualizados: number;
  erros: { linha: number; motivo: string }[];
}

// ---- sync ----

export interface PacoteFormulario {
  formulario_id: ID;
  nome: string;
  versao: FormularioVersao;
  avaliados: ID[] | "todos";
}

export interface PacoteSync {
  cursor: ISO;
  membro: Membro;
  org: Organizacao;
  formularios: PacoteFormulario[];
  avaliados: Avaliado[];
  /** "formulario_id|avaliado_id" -> questao_key -> última resposta conhecida */
  anteriores: Record<string, Record<string, { conforme: boolean | null; resposta?: Answers[string] }>>;
}

export interface InspecaoEnvio {
  client_uuid: string;
  formulario_id: ID;
  formulario_versao_id: ID;
  avaliado_id: ID;
  status: "rascunho" | "completa";
  iniciada_em: ISO;
  finalizada_em: ISO | null;
  geo_inicio?: { lat: number; lng: number } | null;
  geo_fim?: { lat: number; lng: number } | null;
  respostas: Answers;
  anexos: AnexoMeta[];
  device_id: string;
}

export type ResultadoEnvio =
  | { client_uuid: string; ok: true; id: ID; nota_pct: number | null; classificacao: string | null }
  | { client_uuid: string; ok: false; erro: "conflito" | "anexo_faltando" | "sem_permissao" | "invalido"; mensagem: string };

export interface FiltroInspecoes {
  busca?: string;
  de?: string; // yyyy-mm-dd
  ate?: string;
  status?: InspecaoStatus | "";
}

export class OfflineError extends Error {
  constructor() { super("Sem conexão"); this.name = "OfflineError"; }
}
