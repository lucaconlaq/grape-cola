import * as grpc from "@grpc/grpc-js";
import type { ServiceDefinition } from "@grpc/grpc-js";
import { describe, expect, it, vi } from "vitest";
import {
	GrapeColaServer,
	createHandler,
	createServer,
	middleware,
	middlewareWithAfter,
	withAfter,
} from "../src/index.js";
import { callEcho, makeClient, makeTestServer, track } from "./helpers/server.js";

const makeHandler = () =>
	createHandler({
		injectInContext: [() => ({ requestId: "test-id" })],
		defaultMiddleware: [middleware<{}>()(async () => ({ logger: { info: vi.fn() } }))],
	});

// ---------------------------------------------------------------------------
// GrapeColaServer
// ---------------------------------------------------------------------------

describe("GrapeColaServer", () => {
	it("can be constructed with ServerOptions", () => {
		const server = new GrapeColaServer({
			injectInContext: [() => ({ requestId: "abc" })],
		});

		expect(server).toBeInstanceOf(GrapeColaServer);
	});

	it("accepts defaultMiddleware in options", () => {
		const mw = middleware<{}>()(async () => ({ logger: console }));

		const server = new GrapeColaServer({
			injectInContext: [],
			defaultMiddleware: [mw],
		});

		expect(server).toBeInstanceOf(GrapeColaServer);
	});

	it("accepts onStart in options", () => {
		const onStart = vi.fn();

		const server = new GrapeColaServer({
			injectInContext: [],
			onStart,
		});

		expect(server).toBeInstanceOf(GrapeColaServer);
	});

	describe("addService()", () => {
		it("registers a service on the server", () => {
			const server = new GrapeColaServer({ injectInContext: [] });

			const fakeDef = {} as ServiceDefinition;
			const fakeImpl = {} as any;

			server.addService(fakeDef, fakeImpl);
		});
	});

	describe("listen()", () => {
		it("returns a promise that resolves with the bound port", async () => {
			const server = track(new GrapeColaServer({ injectInContext: [] }));

			const port = await server.listen("0.0.0.0", 0);

			expect(typeof port).toBe("number");
			expect(port).toBeGreaterThan(0);
		});

		it("calls onStart with ctx and port on success", async () => {
			const onStart = vi.fn();
			const server = track(
				new GrapeColaServer({
					injectInContext: [() => ({ fromCtx: true })],
					onStart,
				}),
			);

			const port = await server.listen("localhost", 0);

			expect(onStart).toHaveBeenCalledOnce();
			expect(onStart).toHaveBeenCalledWith({ ctx: { fromCtx: true }, port });
		});

		it("calls onStart with error on bind failure", async () => {
			const onStart = vi.fn();
			const blocker = track(new GrapeColaServer({ injectInContext: [] }));
			const blockerPort = await blocker.listen("localhost", 0);

			const server = track(
				new GrapeColaServer({
					injectInContext: [() => ({ fromCtx: true })],
					onStart,
				}),
			);

			await expect(server.listen("localhost", blockerPort)).rejects.toThrow();

			expect(onStart).toHaveBeenCalledOnce();
			expect(onStart.mock.calls[0][0].ctx).toEqual({ fromCtx: true });
			expect(onStart.mock.calls[0][0].error).toBeInstanceOf(Error);
			expect(onStart.mock.calls[0][0].port).toBeUndefined();
		});

		it("does not throw when onStart is not provided", async () => {
			const server = track(new GrapeColaServer({ injectInContext: [() => ({})] }));

			const port = await server.listen("localhost", 0);

			expect(port).toBeGreaterThan(0);
		});

		it("awaits async onStart before resolving", async () => {
			const order: string[] = [];

			const server = track(
				new GrapeColaServer({
					injectInContext: [],
					onStart: async () => {
						await new Promise((r) => setTimeout(r, 10));
						order.push("onStart");
					},
				}),
			);

			await server.listen("localhost", 0);
			order.push("resolved");

			expect(order).toEqual(["onStart", "resolved"]);
		});

		it("onStart receives middleware-resolved context", async () => {
			const onStart = vi.fn();
			const mw = middleware<{}>()(async () => ({ added: "from-mw" }));

			const server = track(
				new GrapeColaServer({
					injectInContext: [() => ({ base: true })],
					defaultMiddleware: [mw],
					onStart,
				}),
			);

			await server.listen("localhost", 0);

			expect(onStart).toHaveBeenCalledOnce();
			expect(onStart).toHaveBeenCalledWith({
				ctx: { base: true, added: "from-mw" },
				port: expect.any(Number),
			});
		});
	});
});

// ---------------------------------------------------------------------------
// createServer()
// ---------------------------------------------------------------------------

describe("createServer()", () => {
	it("returns a GrapeColaServer instance", () => {
		const server = createServer({ handler: makeHandler() });

		expect(server).toBeInstanceOf(GrapeColaServer);
	});

	it("passes onStart through to the server", () => {
		const onStart = vi.fn();

		const server = createServer({ handler: makeHandler(), onStart });

		expect(server).toBeInstanceOf(GrapeColaServer);
	});

	it("infers context type in onStart from handler", () => {
		createServer({
			handler: makeHandler(),
			onStart: ({ ctx }) => {
				ctx.requestId satisfies string;
				ctx.logger satisfies { info: (...args: any[]) => any };
			},
		});
	});

	it("supports adding multiple services", () => {
		const server = createServer({ handler: makeHandler() });

		const def1 = {} as ServiceDefinition;
		const def2 = {} as ServiceDefinition;

		server.addService(def1, {} as any);
		server.addService(def2, {} as any);
	});

	it("listen binds and returns the port", async () => {
		const server = track(createServer({ handler: makeHandler() }));

		const port = await server.listen("127.0.0.1", 0);

		expect(port).toBeGreaterThan(0);
	});

	it("wires handler injectInContext and defaultMiddleware into the server", async () => {
		const onStart = vi.fn();
		const mw = middleware<{}>()(async () => ({ added: "from-mw" }));

		const handler = createHandler({
			injectInContext: [() => ({ base: true })],
			defaultMiddleware: [mw],
		});

		const server = track(createServer({ handler, onStart }));
		await server.listen("localhost", 0);

		expect(onStart).toHaveBeenCalledWith({
			ctx: { base: true, added: "from-mw" },
			port: expect.any(Number),
		});
	});
});

// ---------------------------------------------------------------------------
// End-to-end: unary handler through real gRPC
// ---------------------------------------------------------------------------

describe("end-to-end unary RPC", () => {
	it("serves a unary RPC and returns the response", async () => {
		const server = track(makeTestServer());
		const port = await server.listen("localhost", 0);
		const client = makeClient(port);

		const reply = await callEcho(client, { id: "42" });

		expect(reply.title).toBe("echo:42");
		client.close();
	});

	it("runs default middleware on each request", async () => {
		const calls: string[] = [];
		const mw = middleware<{}>()(async () => {
			calls.push("mw");
			return { traced: true };
		});

		const server = track(
			makeTestServer({
				defaultMiddleware: [mw],
				handlerFn: async ({ ctx }) => {
					expect(ctx.traced).toBe(true);
					return { title: "ok" };
				},
			}),
		);
		const port = await server.listen("localhost", 0);
		const client = makeClient(port);

		await callEcho(client, { id: "" });
		await callEcho(client, { id: "" });

		expect(calls).toEqual(["mw", "mw"]);
		client.close();
	});

	it("runs per-handler middleware via .use()", async () => {
		const order: string[] = [];

		const server = track(
			makeTestServer({
				handlerMiddlewares: [
					async () => {
						order.push("per-handler-mw");
						return { extra: true };
					},
				],
				handlerFn: async ({ ctx }) => {
					order.push("handler");
					expect(ctx.extra).toBe(true);
					return { title: "done" };
				},
			}),
		);
		const port = await server.listen("localhost", 0);
		const client = makeClient(port);

		const reply = await callEcho(client, { id: "" });

		expect(reply.title).toBe("done");
		expect(order).toEqual(["per-handler-mw", "handler"]);
		client.close();
	});

	it("runs after functions in reverse order", async () => {
		const order: number[] = [];

		const mw1 = middlewareWithAfter<{}>()(async () =>
			withAfter({ a: 1 }, () => {
				order.push(1);
			}),
		);
		const mw2 = middlewareWithAfter<{}>()(async () =>
			withAfter({ b: 2 }, () => {
				order.push(2);
			}),
		);

		const server = track(
			makeTestServer({
				handlerMiddlewares: [mw1, mw2],
				handlerFn: async () => {
					order.push(0);
					return { title: "" };
				},
			}),
		);
		const port = await server.listen("localhost", 0);
		const client = makeClient(port);

		await callEcho(client, { id: "" });

		expect(order).toEqual([0, 2, 1]);
		client.close();
	});

	it("injects context from injectInContext", async () => {
		const server = track(
			makeTestServer({
				injectInContext: [() => ({ injected: "value" })],
				handlerFn: async ({ ctx }) => {
					return { title: ctx.injected };
				},
			}),
		);
		const port = await server.listen("localhost", 0);
		const client = makeClient(port);

		const reply = await callEcho(client, { id: "" });

		expect(reply.title).toBe("value");
		client.close();
	});

	it("returns INTERNAL error when handler throws", async () => {
		const server = track(
			makeTestServer({
				handlerFn: async () => {
					throw new Error("boom");
				},
			}),
		);
		const port = await server.listen("localhost", 0);
		const client = makeClient(port);

		await expect(callEcho(client, { id: "" })).rejects.toMatchObject({
			code: grpc.status.INTERNAL,
			details: "boom",
		});
		client.close();
	});
});
