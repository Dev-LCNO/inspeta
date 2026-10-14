// Telas ainda não construídas: rota existe, diz o que vem e em qual marco.
import { EmptyState, PageHeader } from "../ui/primitives";
import type { IconName } from "../ui/icons";

export const STUBS: Record<string, { id: string; titulo: string; marco: number; icon: IconName; texto: string }> = {
  "/web/planos": { id: "S24–S26", titulo: "Planos de ação", marco: 2, icon: "target", texto: "Modelos de plano, disparo automático quando uma inspeção tem não conformidade, link para o responsável responder sem login e acompanhamento de prazos." },
  "/web/painel": { id: "Painel", titulo: "Painel de indicadores", marco: 3, icon: "chart", texto: "Nota média por avaliado e por mês, não conformidades mais frequentes e inspeções atrasadas." },
  "/web/aprovacoes": { id: "S32", titulo: "Aprovações", marco: 3, icon: "stamp", texto: "Inspeções e planos esperando a sua decisão, em uma ou mais etapas." },
  "/web/workflows": { id: "S27–S29", titulo: "Workflows", marco: 4, icon: "flow", texto: "Sequências de formulários que avançam sozinhas conforme a classificação da nota." },
  "/web/permissoes": { id: "S30", titulo: "Permissões", marco: 2, icon: "shield", texto: "Quais formulários cada pessoa ou equipe aplica, quais avaliados enxerga e de quem vê as inspeções." },
  "/web/funcoes": { id: "S31", titulo: "Funções", marco: 2, icon: "key", texto: "Cargos com as ações que cada um pode fazer: criar formulários, aplicar, editar, aprovar." },
  "/web/formularios/preconfiguradas": { id: "S19", titulo: "Questões pré-configuradas", marco: 4, icon: "copy", texto: "Biblioteca de questões reutilizáveis em vários formulários." },
  "/web/formularios/importar": { id: "S20", titulo: "Importar formulário", marco: 3, icon: "upload", texto: "Monte o formulário numa planilha modelo e importe." },
  "/web/avaliados/importar": { id: "S23", titulo: "Importar avaliados", marco: 2, icon: "upload", texto: "Suba uma planilha, associe as colunas aos campos e importe de uma vez." },
};

export function Stub({ path }: { path: string }) {
  const s = STUBS[path] ?? { id: "?", titulo: "Página", marco: 0, icon: "info" as IconName, texto: "Esta página ainda não existe." };
  return (
    <>
      <PageHeader title={s.titulo} />
      <div className="card flat">
        <EmptyState icon={s.icon} title={`Chega no marco ${s.marco}`} text={s.texto} />
        <p className="muted" style={{ textAlign: "center", margin: 0, fontSize: "var(--text-xs)" }}>Tela {s.id} do mapa de reconhecimento</p>
      </div>
    </>
  );
}
