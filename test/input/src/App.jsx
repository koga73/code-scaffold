import {Routes, Route} from "react-router";

import {routes} from "@/router/routes";

import "./App.scss";

const App = () => {
	return (
		<Routes>
			{routes.map((route, routeIndex) => (
				<Route {...route} key={routeIndex} />
			))}
			<Route
				path="*"
				element={
					<div>
						<h1>404</h1>
					</div>
				}
			/>
		</Routes>
	);
};
export default App;
