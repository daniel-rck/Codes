export const ROUTES = {
  scan: "/",
  generate: "/erstellen",
  history: "/verlauf",
} as const;

export type RouteKey = keyof typeof ROUTES;
