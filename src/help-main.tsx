import React from "react";
import ReactDOM from "react-dom/client";
import { HelpApp } from "./help/HelpApp";
import "./index.css";

ReactDOM.createRoot(document.getElementById("help-root")!).render(
  <React.StrictMode>
    <HelpApp />
  </React.StrictMode>
);
