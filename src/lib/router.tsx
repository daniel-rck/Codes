import { createBrowserRouter } from "react-router-dom";
import { NotFoundPage, RouteError } from "../features/errors/RouteError.tsx";
import { ROUTES } from "./routes.ts";

export const router = createBrowserRouter([
  {
    path: ROUTES.scan,
    errorElement: <RouteError />,
    lazy: async () => {
      const { AppLayout } = await import("../App.tsx");
      return { Component: AppLayout };
    },
    children: [
      {
        index: true,
        lazy: async () => {
          const { ScanPage } = await import("../features/scan/ScanPage.tsx");
          return { Component: ScanPage };
        },
      },
      {
        path: ROUTES.generate,
        lazy: async () => {
          const { GeneratePage } = await import("../features/generate/GeneratePage.tsx");
          return { Component: GeneratePage };
        },
      },
      {
        path: ROUTES.history,
        lazy: async () => {
          const { HistoryPage } = await import("../features/history/HistoryPage.tsx");
          return { Component: HistoryPage };
        },
      },
      { path: "*", Component: NotFoundPage },
    ],
  },
]);
