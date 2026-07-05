import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { registerSW } from "virtual:pwa-register";
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "./index.css";
import { useAppTheme } from "./theme/useAppTheme";
import router from "./router";
import { startAutoSync } from "./sync";

const App = () => {
  const theme = useAppTheme();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RouterProvider router={router} />
    </ThemeProvider>
  );
};

const container = document.getElementById("root")!;
const root = ReactDOM.createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// autoUpdate-equivalent: a new SW takes over as soon as it's installed,
// reloading isn't forced on the user mid-session — next load picks it up.
registerSW({ immediate: true });
startAutoSync();
