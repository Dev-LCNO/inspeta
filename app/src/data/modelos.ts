// Modelos de questionário prontos. Escritos para este produto, no mesmo formato da planilha do S20,
// então passam pelo mesmo leitor (lerFormulario) e saem validados pelo motor.
import type { FormDefinition } from "@app/form-engine";
import { COLUNAS_MODELO, lerFormulario } from "./importarFormulario";

interface Modelo { id: string; nome: string; descricao: string; linhas: string[][] }

const SN = "Sim/Não";
export const MODELOS: Modelo[] = [
  {
    id: "abertura-loja", nome: "Abertura de loja", descricao: "Ronda rápida antes de abrir as portas: limpeza, temperatura, validade e segurança.",
    linhas: [
      ["Salão de vendas", "Piso e corredores limpos e secos?", SN, "sim", "", "", "", "", "", "", "não", ""],
      ["", "Iluminação toda funcionando?", SN, "sim", "", "", "", "", "", "", "não", ""],
      ["", "Ofertas do dia com preço correto na gôndola?", SN, "sim", "", "", "", "", "", "", "não", "Confira 5 itens das ofertas no caixa."],
      ["Perecíveis", "Temperatura do balcão de frios", "Número", "sim", "", "", "", "°C", "0", "5", "sim", "Foto do visor do balcão."],
      ["", "Temperatura das ilhas de congelados", "Número", "sim", "", "", "", "°C", "", "-18", "sim", ""],
      ["", "Produtos vencidos retirados da área de venda?", SN, "sim", "", "", "", "", "", "", "não", ""],
      ["Segurança", "Extintores no lugar e sinalizados?", SN, "sim", "", "", "", "", "", "", "não", ""],
      ["", "Saídas de emergência desobstruídas?", SN, "sim", "", "", "", "", "", "", "não", ""],
      ["Encerramento", "Observações", "Texto", "não", "", "", "", "", "", "", "não", ""],
      ["", "Assinatura do encarregado", "Assinatura", "sim", "", "", "", "", "", "", "não", ""],
    ],
  },
  {
    id: "recebimento", nome: "Recebimento de mercadorias", descricao: "Conferência na doca: documento, transporte, temperatura e avarias.",
    linhas: [
      ["Documento", "Número da nota fiscal", "Texto", "sim", "", "", "", "", "", "", "não", ""],
      ["", "Quantidade de volumes confere com a nota?", SN, "sim", "", "", "", "", "", "", "não", ""],
      ["Transporte", "Baú limpo e sem odor?", SN, "sim", "", "", "", "", "", "", "não", ""],
      ["", "Lacre íntegro?", SN, "sim", "", "", "", "", "", "", "sim", "Foto do lacre antes de abrir."],
      ["Produto", "Temperatura do produto na chegada", "Número", "sim", "", "", "", "°C", "", "7", "não", "Meça no centro da caixa."],
      ["", "Embalagens", "Escolha única", "sim", "Íntegras; Algumas amassadas; Rasgadas ou molhadas", "10; 5; 0", "Rasgadas ou molhadas", "", "", "", "não", ""],
      ["", "Validade mínima atendida?", SN, "sim", "", "", "", "", "", "", "não", "Regra comum: pelo menos 2/3 do prazo restante."],
      ["", "Decisão", "Escolha única", "sim", "Aceito; Aceito com ressalva; Recusado", "10; 5; 0", "Recusado", "", "", "", "não", ""],
    ],
  },
  {
    id: "manipuladores", nome: "Higiene de manipuladores", descricao: "Boas práticas de quem manipula alimentos em padaria, açougue e rotisseria.",
    linhas: [
      ["Apresentação", "Uniforme limpo e completo?", SN, "sim", "", "", "", "", "", "", "não", ""],
      ["", "Cabelo protegido por touca?", SN, "sim", "", "", "", "", "", "", "não", ""],
      ["", "Sem adornos (anel, relógio, brinco)?", SN, "sim", "", "", "", "", "", "", "não", ""],
      ["", "Unhas curtas e sem esmalte?", SN, "sim", "", "", "", "", "", "", "não", ""],
      ["Práticas", "Lavagem das mãos observada na troca de tarefa?", SN, "sim", "", "", "", "", "", "", "não", ""],
      ["", "Pia de mãos com sabão, papel e lixeira com pedal?", SN, "sim", "", "", "", "", "", "", "sim", ""],
      ["", "Alimentos prontos separados dos crus?", SN, "sim", "", "", "", "", "", "", "não", ""],
      ["", "Setor avaliado", "Escolha única", "sim", "Padaria; Açougue; Rotisseria; Hortifrúti", "", "", "", "", "", "não", ""],
    ],
  },
  {
    id: "camara-fria", nome: "Câmara fria", descricao: "Temperatura, organização e conservação das câmaras de resfriados e congelados.",
    linhas: [
      ["Temperatura", "Temperatura da câmara de resfriados", "Número", "sim", "", "", "", "°C", "0", "4", "sim", ""],
      ["", "Temperatura da câmara de congelados", "Número", "sim", "", "", "", "°C", "", "-18", "sim", ""],
      ["", "Registro de temperatura do dia preenchido?", SN, "sim", "", "", "", "", "", "", "não", ""],
      ["Organização", "Produtos sobre estrados, longe do piso e das paredes?", SN, "sim", "", "", "", "", "", "", "não", ""],
      ["", "Primeiro que vence, primeiro que sai (PVPS) respeitado?", SN, "sim", "", "", "", "", "", "", "não", ""],
      ["", "Condições observadas", "Múltipla escolha", "sim", "Piso limpo; Sem gelo acumulado; Porta veda bem; Gelo no evaporador; Produto sem etiqueta", "3; 3; 4; 0; 0", "Gelo no evaporador; Produto sem etiqueta", "", "", "", "não", ""],
      ["Encerramento", "Assinatura do responsável", "Assinatura", "sim", "", "", "", "", "", "", "não", ""],
    ],
  },
];

export function definicaoDoModelo(id: string): FormDefinition {
  const m = MODELOS.find((x) => x.id === id);
  if (!m) throw new Error("Modelo não encontrado.");
  const r = lerFormulario([COLUNAS_MODELO, ...m.linhas]);
  if (!r.definicao || r.erros.length) throw new Error("Modelo inválido: " + r.erros.map((e) => e.motivo).join("; "));
  return r.definicao;
}

export const qtdQuestoes = (id: string) => MODELOS.find((x) => x.id === id)?.linhas.length ?? 0;
