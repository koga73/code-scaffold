import {createRoot} from "react-dom/client";
import {BrowserRouter} from "react-router";

import App from "@/App";

import packageJson from "../package.json";

const baseUrl = document.getElementsByTagName("base")[0].getAttribute("href") ?? "";
const appElementId = "app";

const Body = (
	<BrowserRouter basename={baseUrl}>
		<App />
	</BrowserRouter>
);

// Welcome message
console.log(`App: ${packageJson.name} v${packageJson.version}`);

const appEl = document.getElementById(appElementId);
createRoot(appEl).render(Body);
