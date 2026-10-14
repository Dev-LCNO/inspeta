// Tipos de domínio — espelham replica/schema.sql (nomes em português, como no banco).
import type { Answers, Evaluation, FormDefinition } from "@app/form-engine";

export type ID = string;
/** posição capturada no aparelho; precisão em metros quando o GPS informa */
export interface Geo { lat: number; lng: number; precisao_m?: number }
export type ISO = string; // timestamptz em UTC

export type Acao =
  | "gerenciar_formularios" | "aplicar" | "editar_inspecao" | "excluir_inspecao"
  | "ver_todas_inspecoes" | "gerenciar_avaliados" | "gerenciar_planos"
  | "gerenciar_agendamentos" | "gerenciar_workflows" | "gerenciar_permissoes"
  | "aprovar" | "ver_painel";

export interface Organizacao { id: ID; nome: string; fuso_horario: string }

/** S31 — cargo com as ações que permite. "sistema" = Administrador (todas, não se edita). */
export interface Funcao { id: ID; nome: string; acoes: Acao[]; sistema?: boolean }

/** Escopo de acesso (S30). Vale para pessoa e para equipe; o efetivo é a união. */
export interface Acesso {
  formularios: ID[] | "todos";
  avaliados: ID[] | "todos";
  /** de quem, além de si, a pessoa vê as inspeções (sem a ação ver_todas_inspecoes) */
  ver_membros: ID[];
  ver_equipes: ID[];
}

export interface Equipe { id: ID; org_id: ID; nome: string; membros: ID[]; acesso: Acesso }

/** Como o membro é guardado (= tabela membros + membros_acesso). */
export interface MembroRegistro {
  id: ID;
  org_id: ID;
  nome: string;
  email: string;
  funcao_id: ID;
  is_master: boolean;
  ativo: boolean;
  acesso: Acesso;
  created_at: string;
}

/** Membro resolvido: o que as telas usam (função, ações e escopos já calculados). */
export interface Membro {
  id: ID;
  org_id: ID;
  nome: string;
  email: string;
  funcao_id: ID;
  funcao: string;
  acoes: Acao[];
  is_master: boolean;
  ativo: boolean;
  equipes: ID[];
  formularios_permitidos: ID[] | "todos";
  avaliados_permitidos: ID[] | "todos";
  /** ids de membros cujas inspeções esta pessoa vê, além das próprias */
  ve_inspecoes_de: ID[];
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
  geo_inicio?: Geo | null;
  geo_fim?: Geo | null;
  respostas: Answers;
  anexos: AnexoMeta[];
  /** ocorrência de agendamento que esta inspeção cumpriu (null = avulsa) */
  ocorrencia_id?: ID | null;
  /** etapa de aprovação atual (1..n) enquanto status = em_aprovacao */
  aprovacao_etapa?: number | null;
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
  acao: "criada" | "sincronizada" | "finalizada" | "editada" | "reaberta" | "relatorio_enviado" | "excluida" | "aprovada" | "reprovada" | "enviada_aprovacao";
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
  /** a resposta do responsável passa por um gestor antes de fechar o plano */
  exige_aprovacao?: boolean;
  created_at: ISO;
  updated_at: ISO;
}

export type PlanoStatus = "aberto" | "em_aprovacao" | "finalizado";
export type PlanoSituacao = PlanoStatus | "em_atraso";

export interface PlanoAcao {
  id: ID;
  org_id: ID;
  modelo_id: ID;
  modelo_snapshot: Pick<PlanoModelo, "nome" | "definicao" | "exige_aprovacao">;
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
  respondido_em?: ISO | null;
  /** correções devolvidas: o que foi respondido e por que não foi aceito */
  reprovacoes?: { em: ISO; por: ID; comentario: string; respondido_por?: string; respostas: Record<string, Answers> }[];
  aprovado_por?: ID | null;
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
  /** "formulario_id|avaliado_id" -> questao_key -> última resposta (só para questões com preenchimento automático/único) */
  ultimas?: Record<string, Answers>;
  /** ocorrências pendentes da pessoa (últimos 7 dias + próximos 14) */
  agenda?: OcorrenciaPacote[];
}

export interface InspecaoEnvio {
  client_uuid: string;
  formulario_id: ID;
  formulario_versao_id: ID;
  avaliado_id: ID;
  status: "rascunho" | "completa";
  iniciada_em: ISO;
  finalizada_em: ISO | null;
  geo_inicio?: Geo | null;
  geo_fim?: Geo | null;
  respostas: Answers;
  anexos: AnexoMeta[];
  device_id: string;
  ocorrencia_id?: ID | null;
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

// ---- aprovações (S32) ----

export interface Aprovacao {
  id: ID;
  org_id: ID;
  inspecao_id: ID;
  etapa: number;
  aprovador_id: ID;
  decisao: "aprovada" | "reprovada";
  comentario?: string;
  em: ISO;
}

// ---- agendamentos (S05–S07, M09) ----

export type Recorrencia = "nenhuma" | "diaria" | "semanal" | "mensal";

/** A regra, sem o que é do banco. É o que o S06 edita e o que agenda.ts calcula. */
export interface RegraAgenda {
  data_inicio: string; // yyyy-mm-dd no fuso do agendamento
  horarios: string[]; // "HH:MM"
  dia_inteiro: boolean;
  fuso_horario: string;
  recorrencia: Recorrencia;
  dias_semana?: number[]; // 0 = domingo
  termino: "nunca" | "data" | "quantidade";
  termino_data?: string;
  termino_qtd?: number;
}

export interface Agendamento extends RegraAgenda {
  id: ID;
  org_id: ID;
  formulario_id: ID;
  avaliado_id: ID;
  responsaveis: ID[];
  ativo: boolean;
  materializado_ate: string | null;
  criado_por: ID | null;
  created_at: ISO;
  updated_at: ISO;
}

export type OcorrenciaStatus = "pendente" | "completa" | "inativa";
/** "atrasada" é derivada: pendente e passou do limite (2 h depois, ou o fim do dia se for o dia inteiro). */
export type OcorrenciaSituacao = OcorrenciaStatus | "atrasada";

export interface Ocorrencia {
  id: ID;
  org_id: ID;
  agendamento_id: ID;
  previsto_em: ISO;
  status: OcorrenciaStatus;
  justificativa?: string;
  inativada_por?: ID | null;
  notificado_em?: ISO | null;
  inspecao_id?: ID | null;
  created_at: ISO;
  updated_at: ISO;
}

/** O que vai para o aparelho: a agenda da pessoa, pronta para abrir offline. */
export interface OcorrenciaPacote {
  id: ID;
  formulario_id: ID;
  avaliado_id: ID;
  previsto_em: ISO;
  dia_inteiro: boolean;
  limite: ISO;
  descricao: string;
}

export class OfflineError extends Error {
  constructor() { super("Sem conexão"); this.name = "OfflineError"; }
}
