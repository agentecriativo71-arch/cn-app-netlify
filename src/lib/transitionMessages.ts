export type TransitionContext = {
  nome?: string | null;
  ocasiao?: string | null;
  peca?: string | null;
  biotipo?: string | null;
};

export type TransitionMessage = {
  title: string;
  subtitle: string;
};

export function getTransitionMessage(
  fromStepId: string,
  toStepId: string,
  ctx: TransitionContext
): TransitionMessage {
  switch (toStepId) {
    case "peca":
      if (ctx.ocasiao) {
        return {
          title: "Ocasião definida.",
          subtitle: "Selecione a peça principal da criação.",
        };
      }
      return {
        title: "Iniciando criação.",
        subtitle: "Selecione a peça principal.",
      };

    case "biotipo":
      return {
        title: "Peça confirmada.",
        subtitle: "Defina a silhueta para garantir um caimento preciso.",
      };

    case "comprimento":
      return {
        title: "Silhueta registrada.",
        subtitle: "Ajuste o comprimento ideal da peça.",
      };

    case "decote":
      return {
        title: "Estrutura definida.",
        subtitle: "Selecione o estilo do decote.",
      };

    case "manga":
      return {
        title: "Modelagem atualizada.",
        subtitle: "Defina o acabamento das mangas.",
      };

    case "saia":
      return {
        title: "Corte selecionado.",
        subtitle: "Defina a estrutura e o volume da saia.",
      };

    case "renda":
      return {
        title: "Detalhes em andamento.",
        subtitle: "Selecione o estilo de renda desejado.",
      };

    case "comentario":
      return {
        title: "Etapas concluídas.",
        subtitle: "Adicione observações ou preferências técnicas.",
      };

    default:
      return {
        title: "Finalizando.",
        subtitle: "Processando os parâmetros da criação...",
      };
  }
}
