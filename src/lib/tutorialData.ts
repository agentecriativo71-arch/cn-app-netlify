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
      "Olá! 👋 Pronta para dar vida ao seu look dos sonhos? Toque no botão 'Aperte para iniciar' e vamos começar juntos! ✨",
    steps: [
      {
        targetSelector: '[data-tutorial="cta-button"]',
        title: "Comece Sua Criação ✨",
        text: "Bem-vinda ao seu ateliê digital! Toque aqui para iniciar a criação do seu look exclusivo. Vamos definir peça, biotipo, caimento e tecidos juntos! 💃",
        tooltipPosition: "top",
      },
    ],
  },

  criar_ocasiao: {
    screenKey: "criar_ocasiao",
    bubbleText: "Qual é o grande dia? Escolha a ocasião para adaptarmos o estilo do seu look! 🥂",
    steps: [
      {
        targetSelector: '[data-tutorial="step-content"]',
        title: "Para Qual Ocasião? 🥂",
        text: "Casamento, festa, trabalho ou dia a dia? Selecione o evento para ajudarmos a inteligência artificial a captar o caimento ideal da peça. Se preferir, pode pular esta etapa! 😉",
      },
    ],
  },
  criar_peca: {
    screenKey: "criar_peca",
    bubbleText: "Escolha o modelo principal da sua roupa (Vestido, Saia, Blusa...) 👗",
    steps: [
      {
        targetSelector: '[data-tutorial="step-content"]',
        title: "A Peça Principal 👗",
        text: "O que vamos desenhar hoje? Escolha a peça base da sua criação — um vestido deslumbrante, uma saia elegante ou uma blusa versátil!",
      },
    ],
  },
  criar_biotipo: {
    screenKey: "criar_biotipo",
    bubbleText: "Selecione seu biotipo para um caimento sob medida perfeito no desenho! 🧍‍♀️",
    steps: [
      {
        targetSelector: '[data-tutorial="step-content"]',
        title: "Modelagem Proporcional 🧍‍♀️",
        text: "Selecione o silhueta/biotipo mais próximo do seu corpo. Isso nos permite desenhar um croqui valorizando suas curvas e proporções exatas!",
      },
    ],
  },
  criar_comprimento: {
    screenKey: "criar_comprimento",
    bubbleText: "Curto, midi ou longo? Defina a extensão da sua peça! 📏",
    steps: [
      {
        targetSelector: '[data-tutorial="step-content"]',
        title: "Comprimento da Peça 📏",
        text: "Prefere um visual mais ousado com comprimento curto, elegante com midi ou sofisticado com longo de gala? Escolha seu estilo preferido!",
      },
    ],
  },
  criar_decote: {
    screenKey: "criar_decote",
    bubbleText: "Defina o formato do decote que mais valoriza seu colo ✂️",
    steps: [
      {
        targetSelector: '[data-tutorial="step-content"]',
        title: "Estilo do Decote ✂️",
        text: "V, coração, tomara que caia ou ombro a ombro? O decote dá toda a personalidade e charme ao busto da sua peça!",
      },
    ],
  },
  criar_manga: {
    screenKey: "criar_manga",
    bubbleText: "Manga bufante, longa, curta ou sem manga? Você decide! 💪",
    steps: [
      {
        targetSelector: '[data-tutorial="step-content"]',
        title: "Desenho das Mangas 💪",
        text: "Escolha o acabamento dos braços: manguinhas delicadas, estilo princesa bufante ou mangas sofisticadas longas!",
      },
    ],
  },
  criar_saia: {
    screenKey: "criar_saia",
    bubbleText: "Fluida, evasê, justa ou pregada? Escolha o movimento da saia 👗",
    steps: [
      {
        targetSelector: '[data-tutorial="step-content"]',
        title: "Caimento da Saia 👗",
        text: "Como você quer o balanço da saia? Selecione o corte que dará a fluidez e o volume desejados no croqui final!",
      },
    ],
  },
  criar_renda: {
    screenKey: "criar_renda",
    bubbleText: "Adicione textura e detalhes delicados de renda 🪡",
    steps: [
      {
        targetSelector: '[data-tutorial="step-content"]',
        title: "Rendas & Bordados 🪡",
        text: "Quer um toque romântico ou sofisticado? Adicione aplicação de rendas no corpo, barrado ou mangas da sua peça!",
      },
    ],
  },
  criar_comentario: {
    screenKey: "criar_comentario",
    bubbleText: "Tem algum detalhe especial em mente? Conte para o Crispim! 💬",
    steps: [
      {
        targetSelector: '[data-tutorial="step-content"]',
        title: "Detalhes Exclusivos 💬",
        text: "Quer fenda lateral, laço grande nas costas, cinto drapeado ou botões forrados? Escreva com suas palavras e o Crispim aplicará na sua ilustração!",
      },
    ],
  },

  croqui: {
    screenKey: "croqui",
    bubbleText:
      "Seu croqui ficou pronto! Você pode ajustar detalhes, simular o tecido realista ou enviar pelo WhatsApp 🎨",
    steps: [
      {
        targetSelector: '[data-tutorial="croqui-image"]',
        title: "Sua Ilustração Exclusiva 🎨",
        text: "Veja que incrível! A IA desenhou seu modelo exclusivo em um croqui de moda de alta costura com todas as opções selecionadas.",
        tooltipPosition: "bottom",
      },
      {
        targetSelector: '[data-tutorial="croqui-actions"]',
        title: "Próximos Passos 🚀",
        text: "Gostou? Você pode simular as cores reais do tecido em foto realista, fazer ajustes finos no desenho ou mandar o projeto direto para os consultores da C&N no WhatsApp!",
        tooltipPosition: "top",
      },
    ],
  },

  realista: {
    screenKey: "realista",
    bubbleText:
      "Escolha a cor ou crie uma personalizada com o botão + para vestirmos o manequim 🎨",
    steps: [
      {
        targetSelector: '[data-tutorial="color-grid"]',
        title: "Paleta de Cores e Tecidos 🎨",
        text: "Selecione uma das cores vibrantes da C&N Tecidos ou toque no botão coloridinho '+' para ajustar o tom exato do tecido em um seletor avançado!",
      },
      {
        targetSelector: '[data-tutorial="generate-button"]',
        title: "Renderizar Manequim Real 🌟",
        text: "Tudo pronto! Toque aqui para vestir nosso manequim virtual 3D com o tecido escolhido e ver como fica a peça real!",
        tooltipPosition: "top",
      },
    ],
  },

  resultado: {
    screenKey: "resultado",
    bubbleText:
      "Sua simulação final ficou pronta! Salve ou fale com nossa equipe no WhatsApp 💚",
    steps: [
      {
        targetSelector: '[data-tutorial="result-image"]',
        title: "Seu Look em Foto Realista! 🎉",
        text: "Confira o resultado final da peça renderizada com textura, luz e drapeado realista no manequim!",
        tooltipPosition: "bottom",
      },
      {
        targetSelector: '[data-tutorial="whatsapp-button"]',
        title: "Orçamento no WhatsApp 💬",
        text: "Toque aqui para enviar este projeto completo (croqui + foto + especificações) para nossas vendedoras no WhatsApp e consultar a disponibilidade de tecidos na loja!",
        tooltipPosition: "top",
      },
    ],
  },
};

/** Retorna chave do localStorage para uma tela */
export function getTutorialStorageKey(screenKey: string): string {
  return `tutorial_completed_${screenKey}`;
}

/** Verifica se tutorial de uma tela já foi completado (Modo Totem/Kiosk: sempre retorna false para exibir a cada novo cliente) */
export function isTutorialCompleted(screenKey: string): boolean {
  return false;
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
