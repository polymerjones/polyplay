import React from "react";
import ReactDOM from "react-dom/client";
import { Buffer } from "buffer";
import { AdminApp } from "./admin/AdminApp";
import "./index.css";
import "../styles.css";

if (typeof globalThis !== "undefined" && !("Buffer" in globalThis)) {
  (globalThis as typeof globalThis & { Buffer?: typeof Buffer }).Buffer = Buffer;
}

ReactDOM.createRoot(document.getElementById("admin-root")!).render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>
);
