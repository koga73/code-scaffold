import PageHome from "@/pages/PageHome/PageHome";
import PageAbout from "@/pages/PageAbout/PageAbout";
import PageContact from "@/pages/PageContact/PageContact";

interface RouteConfig {
	url: string;
	name: string;
}

interface RoutesConfig {
	HOME: RouteConfig;
	ABOUT: RouteConfig;
	CONTACT: RouteConfig;
}

const ROUTES: RoutesConfig = {
	HOME: {url: "/", name: "Home"},
	ABOUT: {url: "/about", name: "About"},
	CONTACT: {url: "/contact", name: "Contact"}
};

const routes = [
	{path: ROUTES.HOME.url, index: true as const, element: <PageHome />},
	{path: ROUTES.ABOUT.url, element: <PageAbout />},
	{path: ROUTES.CONTACT.url, element: <PageContact />}
];

export default ROUTES;
export {routes};
