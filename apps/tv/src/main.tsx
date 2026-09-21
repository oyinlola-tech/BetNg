import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { initRuntime } from "./services/runtime";
import { logger } from "./services/logger";
import "./styles/app.css";

const container = document.getElementById("root");

if (container === null) throw new Error("The #root element is missing from index.html.");

const root = createRoot(container);

initRuntime()
  .then(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((cause: unknown) => {
    logger.error("flow", "BETNG TV could not start", { cause: cause instanceof Error ? cause.message : "unknown" });
    container.textContent = "BETNG TV could not start. This display will retry in 30 seconds.";
    setTimeout(() => {
      window.location.reload();
    }, 30_000);
  });
