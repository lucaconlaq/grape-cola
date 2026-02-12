import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			"@lucaconlaq/grape-cola": resolve(__dirname, "..", "src", "index.ts"),
		},
	},
	test: {
		root: __dirname,
		include: ["test/**/*.test.ts"],
	},
});
