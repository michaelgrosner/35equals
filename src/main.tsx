import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { App } from "@/App";
import "@/styles/globals.css";

if (import.meta.env.DEV) {
  document.title = '[DEV] 35equals';
}

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("Root element #root not found in the document.");
}

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <App />
    </ThemeProvider>
  </StrictMode>
);
