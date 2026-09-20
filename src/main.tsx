import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./prototype/App";
import { AppStateProvider } from "./prototype/state/AppStateProvider";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppStateProvider><App /></AppStateProvider>
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("./sw.js");
  });
}
