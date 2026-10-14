// Telas ainda não construídas: rota existe, diz o que vem e em qual marco.
import { EmptyState, PageHeader } from "../ui/primitives";
import type { IconName } from "../ui/icons";

export const STUBS: Record<string, { id: string; titulo: string; marco: number; icon: IconName; texto: string }> = {
  "/web/aprovacoes": { id: "S32", titulo: "Aprovações", marco: 3, icon: "stamp", texto: "Inspeções e planos esperando a sua decisão, em uma ou mais etapas." },
  "/web/workflows": { id: "S27–S29", titulo: "Workflows", marco: 4, icon: "flow", texto: "Sequências de formulários que avançam sozinhas conforme a classificação da nota." },
  "/web/formularios/preconfiguradas": { id: "S19", titulo: "Questões pré-configuradas", marco: 4, icon: "copy", texto: "Biblioteca de questões reutilizáveis em vários formulários." },
  "/web/formularios/importar": { id: "S20", titulo: "Importar formulário", marco: 3, icon: "upload", texto: "Monte o formulário numa planilha modelo e importe." },
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
