// Formato do documento de formulário (o mesmo JSON salvo em formulario_versoes.definicao).
// Toda questão, opção e tópico tem uma `key` estável entre versões.

export type QuestionType =
  | "texto"
  | "numerica"
  | "escolha_simples"
  | "escolha_multipla"
  | "data_hora"
  | "assinatura"
  | "calculo";

export interface Dependency {
  questao: string; // key da questão de escolha
  opcao: string; // key da opção que libera
}

export interface Desconto {
  pct: number; // 0–100
  escopo: "topico" | "formulario";
}

export interface Option {
  key: string;
  texto: string;
  pontos?: number;
  conforme?: boolean | null; // true conforme, false não conforme, null/undefined sem regra
  na?: boolean; // "Não se aplica": sai do cálculo
  desconto?: Desconto;
}

export interface FaixaNota {
  ate: number | null; // limite superior inclusivo; null = sem limite
  pontos: number;
}

export interface NumericConfig {
  formato: "decimal" | "inteiro" | "percentual";
  unidade?: string;
  limite?: { min?: number | null; max?: number | null; obs_obrigatoria?: boolean };
  faixas_nota?: FaixaNota[];
  incremento?: number | null;
}

export interface NcExige {
  observacao?: boolean;
  foto?: boolean;
}

export interface Question {
  key: string;
  titulo: string;
  tipo: QuestionType;
  obrigatoria?: boolean;
  foto_obrigatoria?: boolean;
  documento_obrigatorio?: boolean;
  ajuda?: { texto?: string };
  preenchimento_automatico?: boolean;
  preenchimento_unico?: boolean;
  depende_de?: Dependency;
  opcoes?: Option[];
  numerica?: NumericConfig;
  texto?: { leitura_codigo?: boolean };
  data_hora?: { campos: "data" | "data_hora" };
  calculo?: { formula: string; valor_se_vazio?: number | null };
  nc_exige?: NcExige; // o que a não conformidade exige
  plano_acao_modelo_id?: string | null;
}

export interface Topic {
  key: string;
  titulo: string;
  depende_de?: Dependency;
  questoes: Question[];
}

export interface Classificacao {
  nome: string;
  cor: "rank-good" | "rank-mid" | "rank-bad" | string; // papel de token, ou hex escolhido pelo usuário
  min: number;
  max: number;
}

export interface FormConfig {
  calcular_nota?: boolean;
  ocultar_nota?: boolean;
  casas_decimais?: 0 | 1 | 2;
  classificacoes?: Classificacao[];
  geo?: "off" | "inicio" | "fim" | "inicio_fim";
  preenchimento_sequencial?: boolean;
  reincidencia_meses?: number;
  relatorio?: { emails?: { avaliado?: boolean; extras?: string[] } };
  /** Etapas em ordem; em cada uma, qualquer um dos aprovadores decide. */
  aprovacao?: { etapas: { aprovadores: string[] }[] };
}

export interface FormDefinition {
  config: FormConfig;
  topicos: Topic[];
}

// Resposta de uma questão, como o app grava.
export interface Answer {
  opcoes?: string[];
  numero?: number | null;
  texto?: string;
  data?: string;
  assinatura?: string; // referência ao anexo
  na?: boolean;
  observacao?: string;
  fotos?: number; // quantidade de fotos anexadas
}

export type Answers = Record<string, Answer | undefined>;

export interface QuestionResult {
  key: string;
  numero: number; // numeração global 1..n na ordem do formulário
  visivel: boolean;
  respondida: boolean;
  na: boolean;
  pontos: number | null;
  pontos_max: number | null;
  conforme: boolean | null;
  valor_calculado?: number | null; // questões de cálculo
  pendencias: Pendencia[];
  reincidente: boolean;
}

export type Pendencia =
  | { tipo: "obrigatoria" }
  | { tipo: "foto" }
  | { tipo: "observacao" }
  | { tipo: "documento" };

export interface TopicResult {
  key: string;
  visivel: boolean;
  pontos: number;
  pontos_max: number;
  desconto_pct: number; // desconto total aplicado (composto)
  pct: number | null;
}

export interface Evaluation {
  questoes: Record<string, QuestionResult>;
  topicos: Record<string, TopicResult>;
  pontos: number;
  pontos_max: number;
  nota_pct: number | null;
  classificacao: Classificacao | null;
  nao_conformidades: string[]; // keys de questões
  pendentes: string[]; // keys de questões com pendências (bloqueiam finalizar)
  respondidas: number;
  visiveis: number;
}

// Última resposta conhecida por questão (reincidência / preenchimento automático).
export type Previous = Record<string, { conforme: boolean | null; resposta?: Answer } | undefined>;
