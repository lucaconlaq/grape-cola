import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const protoDir = join(__dirname, "..", "proto");

const outDirs = [join(__dirname, "..", "server", "gen"), join(__dirname, "..", "client", "gen")];

const generate = (outDir: string) => {
	mkdirSync(outDir, { recursive: true });

	execSync(
		[
			"grpc_tools_node_protoc",
			`-I "${protoDir}"`,
			`--js_out=import_style=commonjs,binary:"${outDir}"`,
			`--grpc_out=grpc_js:"${outDir}"`,
			`--ts_out=grpc_js:"${outDir}"`,
			`"${protoDir}"/*.proto`,
		].join(" "),
		{ stdio: "inherit" },
	);

	// Ensure gen/ is treated as CJS by Node when the parent package uses "type": "module"
	writeFileSync(join(outDir, "package.json"), '{ "type": "commonjs" }\n');

	// Patch *_pb.js files so Node's ESM named-export detection works.
	// The codegen uses `goog.object.extend(exports, proto.*)` which is too dynamic
	// for Node's static CJS analysis. We append explicit `exports.X = ...` lines.
	for (const file of readdirSync(outDir)) {
		if (!file.endsWith("_pb.js") || file.endsWith("_grpc_pb.js")) continue;
		const filePath = join(outDir, file);
		const src = readFileSync(filePath, "utf8");
		const match = src.match(/goog\.object\.extend\(exports,\s*(proto\.\w+)\)/);
		if (!match) continue;
		const ns = match[1]; // e.g. "proto.hello"
		// Find all class-like assignments: proto.hello.Foo = function(
		const classes = [...src.matchAll(new RegExp(`${ns.replace(".", "\\.")}\\.(\\w+)\\s*=\\s*function\\(`, "g"))].map(
			(m) => m[1],
		);
		const unique = [...new Set(classes)];
		if (unique.length === 0) continue;
		const lines = unique.map((name) => `exports.${name} = ${ns}.${name};`);
		writeFileSync(
			filePath,
			`${src}\n// Explicit re-exports for Node.js ESM named-export detection\n${lines.join("\n")}\n`,
		);
	}
};

for (const outDir of outDirs) {
	generate(outDir);
}
