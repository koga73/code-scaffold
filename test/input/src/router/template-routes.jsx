import PageHome from "@/pages/PageHome/PageHome";

const ROUTES = {
	HOME: {url: "/", name: "Home"}
};

const routes = [{path: ROUTES.HOME.url, index: true, element: <PageHome />}];

export default ROUTES;
export {routes};
