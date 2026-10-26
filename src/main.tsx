import { createRoot } from "react-dom/client";
import { installLocalApi } from "./lib/local-api";
import App from "./App.tsx";
import "./index.css";

installLocalApi();
createRoot(document.getElementById("root")!).render(<App />);
