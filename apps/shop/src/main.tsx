import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installGlobalLogging } from "@betng/ui-web";
import { App } from "./App";
import { logger } from "./services/logger";
import { initRuntime } from "./services/runtime";
import "./styles/app.css";

const container = document.getElementById("root");

if (container === null) throw new Error("The #root element is missing from index.html.");

installGlobalLogging(logger);

initRuntime()
  .then(() => {
    createRoot(container).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((cause: unknown) => {
    logger.error("flow", "The shop terminal could not start", { message: cause instanceof Error ? cause.message : "unknown" });
    container.textContent = "The terminal could not start. Reload the page, or contact your manager if this continues.";
  });
