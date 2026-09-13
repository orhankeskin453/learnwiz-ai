import "@fontsource-variable/inter";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import "./index.css";
import "./i18n";
import { routes } from "./routes";
import { ThemeProvider } from "./theme/ThemeProvider";
import { AuthProvider } from "./auth/AuthProvider";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

const router = createBrowserRouter(routes);

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
