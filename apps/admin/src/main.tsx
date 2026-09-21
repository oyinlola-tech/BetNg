import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installGlobalLogging } from "@betng/ui-web";
import { App } from "./App";
import { initRuntime, logger } from "./services/runtime";
import "./styles/app.css";

async function start(): Promise<void> {
  const container = document.getElementById("root");

  if (container === null) throw new Error("The #root element is missing from index.html.");

  installGlobalLogging(logger);

  const runtime = await initRuntime();

  createRoot(container).render(
    <StrictMode>
      <App flags={runtime.flags} />
    </StrictMode>,
  );
}

void start();
