import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import logoUrl from "../assets/logo.jpg?url";
import { VideoBackground } from "@/components/VideoBackground";
import { CRISPIM_AI_LABEL } from "@/lib/brandCopy";
import { shouldRenderVideoBackground } from "@/lib/dashboardVisual";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          Page not found
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back
          home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: "C&N Tecidos — Agente Criativo" },
        {
          name: "description",
          content: `Crie seu look com a ${CRISPIM_AI_LABEL}. Croqui e foto realista em segundos.`,
        },
        { name: "theme-color", content: "#1A6B2F" },
        { property: "og:title", content: "C&N Tecidos — Agente Criativo" },
        {
          property: "og:description",
          content: `Crie seu look com a ${CRISPIM_AI_LABEL}. Croqui e foto realista em segundos.`,
        },
        { property: "og:type", content: "website" },
        { name: "twitter:title", content: "C&N Tecidos — Agente Criativo" },
        {
          name: "twitter:description",
          content: `Crie seu look com a ${CRISPIM_AI_LABEL}. Croqui e foto realista em segundos.`,
        },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [
        { rel: "icon", href: logoUrl, type: "image/jpeg" },
        { rel: "stylesheet", href: appCss },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossOrigin: "anonymous",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700&display=swap",
        },
      ],
    }),
    shellComponent: RootShell,
    component: RootComponent,
    notFoundComponent: NotFoundComponent,
    errorComponent: ErrorComponent,
  },
);

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <QueryClientProvider client={queryClient}>
      <div className="app-bg overflow-x-hidden min-h-screen relative">
        {shouldRenderVideoBackground(pathname) && <VideoBackground />}

        {/* Animated Particles/Orbs layer */}
        <div className="blob-decor blob-decor--top" />
        <div className="blob-decor blob-decor--bottom" />

        {/* Top-left Wave Lines */}
        <svg
          className="absolute top-0 left-0 w-[300px] h-[300px] sm:w-[450px] sm:h-[450px] opacity-15 pointer-events-none z-0"
          viewBox="0 0 300 300"
          fill="none"
          stroke="#E6DEC9"
          strokeWidth="1.2"
        >
          <path d="M -10,30 C 30,35 50,15 70,-10" />
          <path d="M -10,50 C 45,55 70,25 100,-10" />
          <path d="M -10,70 C 60,75 90,35 130,-10" />
          <path d="M -10,95 C 80,100 110,45 170,-10" />
          <path d="M -10,120 C 100,125 135,55 210,-10" />
          <path d="M -10,150 C 120,155 160,70 260,-10" />
          <path d="M -10,180 C 145,185 190,80 310,-10" />
        </svg>

        {/* Bottom-right Wave Lines */}
        <svg
          className="absolute bottom-0 right-0 w-[300px] h-[300px] sm:w-[450px] sm:h-[450px] opacity-15 pointer-events-none z-0"
          viewBox="0 0 300 300"
          fill="none"
          stroke="#E6DEC9"
          strokeWidth="1.2"
        >
          <path d="M 310,270 C 270,265 250,285 230,310" />
          <path d="M 310,250 C 255,245 230,275 200,310" />
          <path d="M 310,230 C 240,225 210,265 170,310" />
          <path d="M 310,205 C 220,200 190,255 130,310" />
          <path d="M 310,180 C 200,175 165,245 90,310" />
          <path d="M 310,150 C 180,145 140,230 40,310" />
          <path d="M 310,120 C 155,115 110,220 -10,310" />
        </svg>

        <div className="relative z-10 flex flex-col min-h-screen">
          <Outlet />
        </div>
      </div>
    </QueryClientProvider>
  );
}
