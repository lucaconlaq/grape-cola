import * as grpc from "@grpc/grpc-js";
import { afterEach } from "vitest";
import { GrapeColaServer, createHandler, createService } from "../../src/index.js";
import { EchoReply, EchoRequest } from "./messages.js";
import { TestServiceDef } from "./services.js";

// ---------------------------------------------------------------------------
// Server lifecycle (auto-shutdown after each test)
// ---------------------------------------------------------------------------

const servers: GrapeColaServer[] = [];

afterEach(() => {
	for (const s of servers) {
		(s as any)._server.forceShutdown();
	}
	servers.length = 0;
});

/** Register a server for automatic shutdown after the current test. */
export const track = (server: GrapeColaServer): GrapeColaServer => {
	servers.push(server);
	return server;
};

// ---------------------------------------------------------------------------
// Test server factory
// ---------------------------------------------------------------------------

export const makeTestServer = (overrides?: {
	injectInContext?: (() => any)[];
	defaultMiddleware?: any[];
	onStart?: any;
	handlerMiddlewares?: any[];
	handlerFn?: (opts: any) => Promise<any>;
}) => {
	const handler = createHandler({
		injectInContext: overrides?.injectInContext ?? [() => ({})],
		defaultMiddleware: overrides?.defaultMiddleware,
	});

	const echoHandler = (() => {
		let b = handler();
		for (const mw of overrides?.handlerMiddlewares ?? []) {
			b = b.use(mw);
		}
		return b;
	})()
		.request(EchoRequest)
		.reply(EchoReply)
		.unary(overrides?.handlerFn ?? (async ({ req }) => ({ title: `echo:${req.id}` })));

	const service = createService<typeof TestServiceDef>({ echo: echoHandler as any });

	const server = new GrapeColaServer({
		injectInContext: handler.injectInContext,
		defaultMiddleware: handler.defaultMiddleware,
		onStart: overrides?.onStart,
	});
	server.addService(TestServiceDef, service);

	return server;
};

// ---------------------------------------------------------------------------
// gRPC client helpers
// ---------------------------------------------------------------------------

export const makeClient = (port: number) =>
	new (grpc.makeGenericClientConstructor(TestServiceDef, "TestService"))(
		`localhost:${port}`,
		grpc.credentials.createInsecure(),
	);

export const callEcho = (client: grpc.Client, request: any): Promise<any> =>
	new Promise((resolve, reject) => {
		(client as any).echo(request, (err: any, res: any) => {
			if (err) reject(err);
			else resolve(res);
		});
	});
