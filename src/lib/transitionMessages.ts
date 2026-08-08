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
  const nome = ctx.nome ? ctx.nome.split(" ")[0] : "";

  switch (toStepId) {
    case "peca":
      if (ctx.ocasiao) {
        return {
          title: "Ocasião registrada",
          subtitle: "Agora, qual peça será o centro da criação?",
        };
      }
      return {
        title: nome ? `Bem-vinda, ${nome}` : "Vamos começar",
        subtitle: "Escolha a peça que dará vida à sua criação.",
      };

    case "biotipo":
      return {
        title: "Ótima escolha de peça",
        subtitle: "Agora, defina a silhueta para um caimento sob medida.",
      };

    case "tipoCerimonia":
      return {
        title: "Momento inesquecível",
        subtitle: "Qual será o estilo da cerimônia?",
      };

    case "rendaDecisao":
      return {
        title: "Clássico e romântico",
        subtitle: "O vestido terá detalhes em renda?",
      };

    case "comprimento":
      return {
        title: "Silhueta definida",
        subtitle: "Qual comprimento combina mais com a proposta?",
      };

    case "decote":
      return {
        title: "Estrutura tomando forma",
        subtitle: "Hora de definir o decote ideal.",
      };

    case "manga":
      return {
        title: "Visual ganhando identidade",
        subtitle: "Defina o estilo das mangas para completar a modelagem.",
      };

    case "saia":
      return {
        title: "Modelagem avançando",
        subtitle: "Escolha a estrutura e o movimento da saia.",
      };

    case "renda":
      return {
        title: "Quase pronta",
        subtitle: "Deseja adicionar detalhes em renda?",
      };

    case "comentario":
      return {
        title: "Últimos ajustes",
        subtitle: "Alguma observação especial para a costureira?",
      };

    default:
      return {
        title: "Tudo certo",
        subtitle: "Preparando sua criação exclusiva...",
      };
  }
}
