import "./PageHome.scss";

const user = {
	givenName: "Test",
	familyName: "Tester"
};

const PageHome = () => {
	return (
		<div id="pageHome" className="page">
			<h2>Hello, {`${user.givenName} ${user.familyName}`}</h2>
		</div>
	);
};
export default PageHome;
