import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { registerSW } from "virtual:pwa-register";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/inter";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

registerSW({
  immediate: true,
  onOfflineReady() {
    console.log("Órbita lista para usarse sin conexión");
  },
  onRegisterError(error) {
    console.error("Error al registrar el Service Worker:", error);
  },
});
