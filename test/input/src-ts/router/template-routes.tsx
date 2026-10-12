import PageHome from "@/pages/PageHome/PageHome";

interface RouteConfig {
	url: string;
	name: string;
}

interface RoutesConfig {
	HOME: RouteConfig;
}

const ROUTES: RoutesConfig = {
	HOME: {url: "/", name: "Home"}
};

const routes = [{path: ROUTES.HOME.url, index: true as const, element: <PageHome />}];

export default ROUTES;
export {routes};
