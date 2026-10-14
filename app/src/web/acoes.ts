// Rótulos das ações de função (S31). Textos próprios.
import type { Acao } from "../data/types";

export const ACOES_INFO: { acao: Acao; nome: string; desc: string }[] = [
  { acao: "aplicar", nome: "Aplicar inspeções", desc: "Usa o app de campo nos formulários liberados para a pessoa." },
  { acao: "gerenciar_formularios", nome: "Criar e editar formulários", desc: "Monta, altera e publica formulários." },
  { acao: "ver_todas_inspecoes", nome: "Ver todas as inspeções", desc: "Sem isto, vê só as próprias e as de quem acompanha." },
  { acao: "editar_inspecao", nome: "Editar inspeção finalizada", desc: "Corrige respostas depois do envio, com registro no histórico." },
  { acao: "excluir_inspecao", nome: "Excluir inspeção", desc: "Remove inspeções do histórico." },
  { acao: "aprovar", nome: "Aprovar inspeções", desc: "Decide nas etapas de aprovação." },
  { acao: "gerenciar_avaliados", nome: "Cadastrar avaliados", desc: "Cria, importa e edita lojas, setores e fornecedores." },
  { acao: "gerenciar_planos", nome: "Gerenciar planos de ação", desc: "Modelos, links e reenvio de planos." },
  { acao: "gerenciar_agendamentos", nome: "Agendar inspeções", desc: "Cria agendas únicas ou recorrentes para outras pessoas." },
  { acao: "ver_painel", nome: "Ver painel de indicadores", desc: "Notas, tendências e não conformidades frequentes." },
  { acao: "gerenciar_workflows", nome: "Gerenciar workflows", desc: "Sequências de formulários que avançam sozinhas." },
  { acao: "gerenciar_permissoes", nome: "Gerenciar pessoas e permissões", desc: "Convida pessoas, define funções, equipes e acessos." },
];
