import {defineConfig, loadEnv} from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({mode}) => {
	const env = loadEnv(mode, process.cwd(), "");

	const isLocal = env.NODE_ENV !== "production";

	return {
		server: {
			port: 3000,
			strictPort: true,
			open: true
		},
		build: {
			outDir: "build",
			sourcemap: isLocal, // Only generate sourcemaps for local development
			rolldownOptions: {
				output: {
					codeSplitting: {
						groups: [
							{
								name: "_vendor-react",
								test: /node_modules[\\/](react|react-dom|react-router)/,
								priority: 30
							},
							{
								name: "_vendor",
								test: /node_modules/,
								priority: 10
							}
						]
					}
				}
			}
		},
		plugins: [
			react({
				babel: {
					plugins: ["babel-plugin-react-compiler"]
				}
			})
		],
		resolve: {
			dedupe: ["react", "react-dom"],
			alias: {
				"@": "/src"
			}
		},
		define: Object.entries(env)
			.filter(([key]) => key.startsWith("REACT_APP_"))
			.reduce(
				(acc, [key, value]) => ({
					[`process.env.${key}`]: JSON.stringify(value),
					...acc
				}),
				{}
			),
		// Remove comments from build output
		minify: "esbuild",
		terserOptions: undefined,
		esbuild: {
			legalComments: "none" // Removes all comments
		}
	};
});
