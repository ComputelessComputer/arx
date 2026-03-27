import "@fontsource/instrument-serif/400.css";
import "@ibm/plex-mono/css/ibm-plex-mono-default.css";
import "@ibm/plex-sans/css/ibm-plex-sans-default.css";
import { StrictMode, } from "react";
import { createRoot, } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!,).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
