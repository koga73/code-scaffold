import type {FC} from "react";

import "./PageHome.scss";

interface User {
	givenName: string;
	familyName: string;
}

const user: User = {
	givenName: "Test",
	familyName: "Tester"
};

const PageHome: FC = () => {
	return (
		<div id="pageHome" className="page">
			<h2>Hello, {`${user.givenName} ${user.familyName}`}</h2>
		</div>
	);
};
export default PageHome;
