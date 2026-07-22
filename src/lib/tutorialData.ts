export type TutorialStep = {
  /** CSS selector do elemento-alvo para o spotlight */
  targetSelector: string;
  /** Título curto exibido no tooltip */
  title: string;
  /** Texto descritivo da dica */
  text: string;
  /** Posição preferida do tooltip em relação ao target */
  tooltipPosition?: "top" | "bottom" | "auto";
};

export type ScreenTutorial = {
  /** Chave única da tela */
  screenKey: string;
  /** Texto resumido exibido na Coach Bubble (acessos seguintes) */
  bubbleText: string;
  /** Steps do spotlight guiado (primeiro acesso) */
  steps: TutorialStep[];
};

// ── Dados dos tutoriais ──────────────────────────────────────────

export const TUTORIAL_DATA: Record<string, ScreenTutorial> = {
  home: {
    screenKey: "home",
    bubbleText:
      "Toque em 'Aperte para iniciar' pra criar seu look exclusivo. Você vai escolher peça, biotipo, cor e mais! ✨",
    steps: [
      {
        targetSelector: '[data-tutorial="cta-button"]',
        title: "Comece aqui!",
        text: "Toque neste botão pra começar a criar seu look exclusivo. Você vai escolher peça, biotipo, cor e mais! ✨",
        tooltipPosition: "top",
      },
    ],
  },

  // Criar: um step por seção — usado de forma dinâmica
  criar_ocasiao: {
    screenKey: "criar_ocasiao",
    bubbleText: "Escolha a ocasião do seu look. Este passo é opcional 😉",
    steps: [
      {
        targetSelector: '[data-tutorial="step-content"]',
        title: "Escolha a ocasião",
        text: "Toque no card que mais combina com o evento. Este passo é opcional 😉",
      },
    ],
  },
  criar_peca: {
    screenKey: "criar_peca",
    bubbleText: "Selecione a peça principal que deseja criar 👗",
    steps: [
      {
        targetSelector: '[data-tutorial="step-content"]',
        title: "Peça principal",
        text: "Selecione a peça principal que deseja criar. Vestido, saia, blusa… qual será? 👗",
      },
    ],
  },
  criar_biotipo: {
    screenKey: "criar_biotipo",
    bubbleText: "Escolha o biotipo mais próximo do seu corpo 🧍‍♀️",
    steps: [
      {
        targetSelector: '[data-tutorial="step-content"]',
        title: "Seu biotipo",
        text: "Escolha o biotipo mais próximo do seu corpo. Isso ajuda a IA criar algo que valorize você! 🧍‍♀️",
      },
    ],
  },
  criar_comprimento: {
    screenKey: "criar_comprimento",
    bubbleText: "Defina o comprimento ideal da peça",
    steps: [
      {
        targetSelector: '[data-tutorial="step-content"]',
        title: "Comprimento",
        text: "Defina o comprimento ideal. Opcional, mas ajuda no resultado!",
      },
    ],
  },
  criar_decote: {
    screenKey: "criar_decote",
    bubbleText: "Escolha o estilo de decote ✂️",
    steps: [
      {
        targetSelector: '[data-tutorial="step-content"]',
        title: "Decote",
        text: "Escolha o estilo de decote. Toque pra selecionar ✂️",
      },
    ],
  },
  criar_manga: {
    screenKey: "criar_manga",
    bubbleText: "Selecione o tipo de manga 💪",
    steps: [
      {
        targetSelector: '[data-tutorial="step-content"]',
        title: "Manga",
        text: "Selecione o tipo de manga 💪",
      },
    ],
  },
  criar_saia: {
    screenKey: "criar_saia",
    bubbleText: "Escolha o modelo de saia 👗",
    steps: [
      {
        targetSelector: '[data-tutorial="step-content"]',
        title: "Modelo de Saia",
        text: "Escolha o modelo de saia 👗",
      },
    ],
  },
  criar_renda: {
    screenKey: "criar_renda",
    bubbleText: "Adicione detalhes em renda 🪡",
    steps: [
      {
        targetSelector: '[data-tutorial="step-content"]',
        title: "Detalhes em Renda",
        text: "Adicione detalhes em renda se quiser um toque especial 🪡",
      },
    ],
  },
  criar_comentario: {
    screenKey: "criar_comentario",
    bubbleText: "Escreva qualquer detalhe extra 💬",
    steps: [
      {
        targetSelector: '[data-tutorial="step-content"]',
        title: "Detalhes Extras",
        text: "Escreva qualquer detalhe extra que deseja no seu look. Laço, cinto, caimento… vale tudo! 💬",
      },
    ],
  },

  croqui: {
    screenKey: "croqui",
    bubbleText:
      "Aqui está seu croqui! Você pode ajustar detalhes, enviar por WhatsApp ou gerar uma foto realista 👗",
    steps: [
      {
        targetSelector: '[data-tutorial="croqui-image"]',
        title: "Seu croqui",
        text: "Aqui está seu croqui gerado pela IA! Analise os detalhes da peça 🎨",
        tooltipPosition: "bottom",
      },
      {
        targetSelector: '[data-tutorial="croqui-actions"]',
        title: "Próximos passos",
        text: "Agora você pode: gerar foto realista, enviar por WhatsApp, ajustar detalhes ou imprimir 📱",
        tooltipPosition: "top",
      },
    ],
  },

  realista: {
    screenKey: "realista",
    bubbleText:
      "Toque na cor desejada pro tecido. Use o + pra criar uma cor personalizada 🎨",
    steps: [
      {
        targetSelector: '[data-tutorial="color-grid"]',
        title: "Escolha a cor",
        text: "Toque na cor desejada pro tecido. Use o botão + pra criar uma cor personalizada 🎨",
      },
      {
        targetSelector: '[data-tutorial="generate-button"]',
        title: "Gerar visualização",
        text: "Quando estiver satisfeita com a cor, toque aqui pra ver sua peça em um manequim virtual ✨",
        tooltipPosition: "top",
      },
    ],
  },

  resultado: {
    screenKey: "resultado",
    bubbleText:
      "Sua peça está pronta! Envie pelo WhatsApp ou crie outro look 🎉",
    steps: [
      {
        targetSelector: '[data-tutorial="result-image"]',
        title: "Seu look pronto!",
        text: "Sua peça está pronta! Essa é a visualização realista do seu look 🎉",
        tooltipPosition: "bottom",
      },
      {
        targetSelector: '[data-tutorial="whatsapp-button"]',
        title: "Compartilhe",
        text: "Envie pelo WhatsApp pra salvar ou compartilhar com quem quiser 💚",
        tooltipPosition: "top",
      },
    ],
  },
};

/** Retorna chave do localStorage para uma tela */
export function getTutorialStorageKey(screenKey: string): string {
  return `tutorial_completed_${screenKey}`;
}

/** Verifica se tutorial de uma tela já foi completado */
export function isTutorialCompleted(screenKey: string): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(getTutorialStorageKey(screenKey)) === "true";
}

/** Marca tutorial de uma tela como completado */
export function markTutorialCompleted(screenKey: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(getTutorialStorageKey(screenKey), "true");
}

/** Reseta tutorial de uma tela (para "Rever tutorial") */
export function resetTutorialCompleted(screenKey: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(getTutorialStorageKey(screenKey));
}
