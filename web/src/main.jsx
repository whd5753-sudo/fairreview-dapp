import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App.jsx";
import { WalletProvider } from "./state/WalletContext.jsx";
import "./App.css";

// basename 은 vite.config.js 의 base("/fairreview-dapp/")에서 끝의 / 만 뗀 값
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <WalletProvider>
        <App />
      </WalletProvider>
    </BrowserRouter>
  </StrictMode>,
);
