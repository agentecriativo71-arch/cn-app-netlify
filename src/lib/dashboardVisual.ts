export function shouldRenderVideoBackground(pathname: string): boolean {
  return !pathname.startsWith("/dashboard");
}
