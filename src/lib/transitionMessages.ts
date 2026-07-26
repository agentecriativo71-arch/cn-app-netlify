export type TransitionContext = {
  nome?: string | null;
  ocasiao?: string | null;
  peca?: string | null;
  biotipo?: string | null;
};

export type TransitionMessage = {
  title: string;
  subtitle: string;
  emoji: string;
};

export function getTransitionMessage(
  fromStepId: string,
  toStepId: string,
  ctx: TransitionContext
): TransitionMessage {
  const nome = ctx.nome ? ctx.nome.split(" ")[0] : "Você";
  const peca = ctx.peca ? ctx.peca.toLowerCase() : "peça";
  const ocasiao = ctx.ocasiao ? ctx.ocasiao.toLowerCase() : "evento";

  switch (toStepId) {
    case "peca":
      if (ctx.ocasiao) {
        return {
          title: `Perfeito para ${ocasiao}! ✨`,
          subtitle: "Agora escolha qual peça vamos desenhar.",
          emoji: "✨",
        };
      }
      return {
        title: "Excelente escolha! 💫",
        subtitle: "Vamos escolher a peça principal do seu look.",
        emoji: "👗",
      };

    case "biotipo":
      return {
        title: `${ctx.peca || "Peça"} escolhida com sucesso! 👗`,
        subtitle: "Agora selecione a silhueta ideal para o caimento perfeito.",
        emoji: "🧍‍♀️",
      };

    case "comprimento":
      return {
        title: "Silhueta definida! 💃",
        subtitle: `Vamos ajustar o comprimento ideal da sua ${peca}.`,
        emoji: "📏",
      };

    case "decote":
      return {
        title: "Modelagem impecável! ✨",
        subtitle: "Escolha o decote para valorizar ainda mais o visual.",
        emoji: "✂️",
      };

    case "manga":
      return {
        title: "Lindo estilo! 💖",
        subtitle: "Vamos escolher o acabamento perfeito para as mangas.",
        emoji: "💪",
      };

    case "saia":
      return {
        title: "Ótimo caimento! 🌟",
        subtitle: "Escolha o movimento e volume da saia.",
        emoji: "👗",
      };

    case "renda":
      return {
        title: "Design incrível! 🪡",
        subtitle: "Quer adicionar textura e detalhes em renda?",
        emoji: "🪡",
      };

    case "comentario":
      return {
        title: "Quase lá, " + nome + "! 💬",
        subtitle: "Algum detalhe especial ou preferência exclusiva?",
        emoji: "💬",
      };

    default:
      return {
        title: "Tudo pronto! ✨",
        subtitle: "Preparando a criação do seu look...",
        emoji: "🎨",
      };
  }
}
