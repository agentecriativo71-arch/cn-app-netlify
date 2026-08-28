type ResettableLook = {
  reset: () => void;
};

type HomeNavigator = {
  navigate: (options: { to: "/" }) => unknown;
};

export function resetLookAndNavigateHome(
  look: ResettableLook,
  router: HomeNavigator,
): void {
  look.reset();
  router.navigate({ to: "/" });
}
