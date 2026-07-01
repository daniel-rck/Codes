import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "./index.css";
import { router } from "./lib/router.tsx";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

// Warm the main-thread zxing module (writer path for the generator) once the
// app is idle. Dynamic import keeps the glue out of the entry chunk.
const warmZXing = () => {
  import("./shared/zxing.ts")
    .then(({ warmZXingModule }) => warmZXingModule())
    .catch(() => undefined);
};
if ("requestIdleCallback" in window) {
  window.requestIdleCallback(warmZXing, { timeout: 5000 });
} else {
  setTimeout(warmZXing, 2500);
}
