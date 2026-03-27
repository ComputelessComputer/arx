import "@fontsource/instrument-serif/index.css";
import "@ibm/plex-mono/css/ibm-plex-mono-default.css";
import "@ibm/plex-sans/css/ibm-plex-sans-default.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
