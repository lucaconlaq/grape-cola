import { describe, expect, it, vi } from "vitest";
import {
	createHandler,
	middleware,
	middlewareWithAfter,
	testHandler,
	testMiddleware,
	withAfter,
} from "../src/index.js";
import { FakeReply, FakeRequest } from "./helpers/messages.js";

// ---------------------------------------------------------------------------
// createHandler()
// ---------------------------------------------------------------------------

describe("createHandler()", () => {
	it("returns a callable handler", () => {
		const handler = createHandler({ injectInContext: [] });

		expect(typeof handler).toBe("function");
	});

	it("calling handler() starts the builder chain", () => {
		const handler = createHandler({ injectInContext: [] });
		const builder = handler();

		expect(typeof builder.use).toBe("function");
		expect(typeof builder.request).toBe("function");
	});

	it("exposes injectInContext on the handler", () => {
		const inject = () => ({ id: 1 });
		const handler = createHandler({ injectInContext: [inject] });

		expect(handler.injectInContext).toEqual([inject]);
	});

	it("exposes defaultMiddleware on the handler", () => {
		const mw = middleware<{}>()(async () => ({ a: 1 }));
		const handler = createHandler({
			injectInContext: [],
			defaultMiddleware: [mw],
		});

		expect(handler.defaultMiddleware).toEqual([mw]);
	});

	it("defaults defaultMiddleware to empty array", () => {
		const handler = createHandler({ injectInContext: [] });

		expect(handler.defaultMiddleware).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Builder chain
// ---------------------------------------------------------------------------

describe("builder chain", () => {
	it(".use() returns a new builder (immutable)", () => {
		const handler = createHandler({ injectInContext: [] });
		const a = handler();
		const b = a.use(async () => ({ extra: true }));

		expect(a).not.toBe(b);
	});

	it("chaining .use() multiple times accumulates middleware", () => {
		const handler = createHandler({ injectInContext: [] });

		const resolved = handler()
			.use(async () => ({ a: 1 }))
			.use(async () => ({ b: 2 }))
			.request(FakeRequest)
			.reply(FakeReply)
			.unary(async ({ ctx }) => {
				const reply = new FakeReply();
				reply.value = `${ctx.a}-${ctx.b}`;
				return reply;
			});

		expect(resolved.__brand).toBe("grape-cola-handler");
		expect(resolved.__type).toBe("unary");
		expect(resolved.middlewares).toHaveLength(2);
	});

	it(".request().reply().unary() produces a unary ResolvedHandler", () => {
		const handler = createHandler({ injectInContext: [] });

		const resolved = handler()
			.request(FakeRequest)
			.reply(FakeReply)
			.unary(async ({ req }) => {
				const reply = new FakeReply();
				reply.value = req.value;
				return reply;
			});

		expect(resolved.__brand).toBe("grape-cola-handler");
		expect(resolved.__type).toBe("unary");
	});

	it(".request().reply().serverStream() produces a serverStream ResolvedHandler", () => {
		const handler = createHandler({ injectInContext: [] });

		const resolved = handler()
			.request(FakeRequest)
			.reply(FakeReply)
			.serverStream(async ({ req, call }) => {
				call.write(new FakeReply(req.value));
			});

		expect(resolved.__type).toBe("serverStream");
	});

	it(".request().reply().clientStream() produces a clientStream ResolvedHandler", () => {
		const handler = createHandler({ injectInContext: [] });

		const resolved = handler()
			.request(FakeRequest)
			.reply(FakeReply)
			.clientStream(async ({ call }) => {
				const names: string[] = [];
				for await (const req of call) {
					names.push(req.value);
				}
				return new FakeReply(names.join(","));
			});

		expect(resolved.__type).toBe("clientStream");
	});

	it(".request().reply().bidiStream() produces a bidiStream ResolvedHandler", () => {
		const handler = createHandler({ injectInContext: [] });

		const resolved = handler()
			.request(FakeRequest)
			.reply(FakeReply)
			.bidiStream(async ({ call }) => {
				for await (const req of call) {
					call.write(new FakeReply(req.value));
				}
			});

		expect(resolved.__type).toBe("bidiStream");
	});

	it("resolved handler embeds the handler function", () => {
		const handler = createHandler({ injectInContext: [] });
		const fn = async ({ req }: { req: FakeRequest }) => new FakeReply(req.value);

		const resolved = handler().request(FakeRequest).reply(FakeReply).unary(fn);

		expect(resolved.fn).toBe(fn);
	});
});

// ---------------------------------------------------------------------------
// middleware()
// ---------------------------------------------------------------------------

describe("middleware()", () => {
	it("returns a typed middleware function", () => {
		const mw = middleware<{}>()(async () => ({ greeting: "hi" }));

		expect(typeof mw).toBe("function");
	});

	it("middleware receives ctx and returns new fields", async () => {
		const mw = middleware<{ name: string }>()(async ({ ctx }) => ({
			greeting: `hi ${ctx.name}`,
		}));

		const result = await mw({ ctx: { name: "world" } });

		expect(result).toEqual({ greeting: "hi world" });
	});
});

// ---------------------------------------------------------------------------
// middlewareWithAfter()
// ---------------------------------------------------------------------------

describe("middlewareWithAfter()", () => {
	it("returns a middleware that produces a [ctx, afterFn] tuple", async () => {
		const afterFn = vi.fn();

		const mw = middlewareWithAfter<{ name: string }>()(async ({ ctx }) =>
			withAfter({ greeting: `hi ${ctx.name}` }, afterFn),
		);

		const [fields, after] = await mw({ ctx: { name: "world" } });

		expect(fields).toEqual({ greeting: "hi world" });
		expect(typeof after).toBe("function");
	});
});

// ---------------------------------------------------------------------------
// withAfter()
// ---------------------------------------------------------------------------

describe("withAfter()", () => {
	it("returns a tuple of [context, afterFn]", () => {
		const afterFn = vi.fn();
		const result = withAfter({ a: 1 }, afterFn);

		expect(result).toEqual([{ a: 1 }, afterFn]);
		expect(result[0]).toEqual({ a: 1 });
		expect(result[1]).toBe(afterFn);
	});
});

// ---------------------------------------------------------------------------
// testHandler()
// ---------------------------------------------------------------------------

describe("testHandler()", () => {
	it("unary: runs middleware and returns reply", async () => {
		const handler = createHandler({ injectInContext: [] });
		const mw = middleware<{}>()(async () => ({ greeting: "hi" }));

		const resolved = handler()
			.use(mw)
			.request(FakeRequest)
			.reply(FakeReply)
			.unary(async ({ ctx }) => {
				const reply = new FakeReply();
				reply.value = ctx.greeting;
				return reply;
			});

		const { reply } = await testHandler(resolved);

		expect(reply.value).toBe("hi");
	});

	it("unary: passes req to the handler", async () => {
		const handler = createHandler({ injectInContext: [] });

		const resolved = handler()
			.request(FakeRequest)
			.reply(FakeReply)
			.unary(async ({ req }) => new FakeReply(req.value));

		const req = new FakeRequest("hello");
		const { reply } = await testHandler(resolved, { req });

		expect(reply.value).toBe("hello");
	});

	it("serverStream: collects written messages in output", async () => {
		const handler = createHandler({ injectInContext: [] });

		const resolved = handler()
			.request(FakeRequest)
			.reply(FakeReply)
			.serverStream(async ({ req, call }) => {
				call.write(new FakeReply(`${req.value}-1`));
				call.write(new FakeReply(`${req.value}-2`));
			});

		const { output } = await testHandler(resolved, { req: new FakeRequest("msg") });

		expect(output).toHaveLength(2);
		expect(output[0].value).toBe("msg-1");
		expect(output[1].value).toBe("msg-2");
	});

	it("clientStream: iterates streamInput and returns reply", async () => {
		const handler = createHandler({ injectInContext: [] });

		const resolved = handler()
			.request(FakeRequest)
			.reply(FakeReply)
			.clientStream(async ({ call }) => {
				const values: string[] = [];
				for await (const req of call) {
					values.push(req.value);
				}
				return new FakeReply(values.join(","));
			});

		const { reply } = await testHandler(resolved, {
			streamInput: [new FakeRequest("a"), new FakeRequest("b")],
		});

		expect(reply.value).toBe("a,b");
	});

	it("bidiStream: reads streamInput and collects writes", async () => {
		const handler = createHandler({ injectInContext: [] });

		const resolved = handler()
			.request(FakeRequest)
			.reply(FakeReply)
			.bidiStream(async ({ call }) => {
				for await (const req of call) {
					call.write(new FakeReply(`echo:${req.value}`));
				}
			});

		const { output } = await testHandler(resolved, {
			streamInput: [new FakeRequest("x"), new FakeRequest("y")],
		});

		expect(output).toHaveLength(2);
		expect(output[0].value).toBe("echo:x");
		expect(output[1].value).toBe("echo:y");
	});

	it("passes baseCtx to middleware", async () => {
		const handler = createHandler({ injectInContext: [] });
		const mw = middleware<{ name: string }>()(async ({ ctx }) => ({
			greeting: `hi ${ctx.name}`,
		}));

		const resolved = handler()
			.use(mw)
			.request(FakeRequest)
			.reply(FakeReply)
			.unary(async ({ ctx }) => new FakeReply(ctx.greeting));

		const { reply } = await testHandler(resolved, {
			baseCtx: { name: "world" },
		});

		expect(reply.value).toBe("hi world");
	});

	it("runs after functions in reverse order", async () => {
		const order: number[] = [];
		const handler = createHandler({ injectInContext: [] });

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

		const resolved = handler()
			.use(mw1)
			.use(mw2)
			.request(FakeRequest)
			.reply(FakeReply)
			.unary(async () => new FakeReply());

		await testHandler(resolved);

		expect(order).toEqual([2, 1]);
	});
});

// ---------------------------------------------------------------------------
// testMiddleware()
// ---------------------------------------------------------------------------

describe("testMiddleware()", () => {
	it("runs middleware and returns merged context", async () => {
		const mw = middleware<{ name: string }>()(async ({ ctx }) => ({
			greeting: `hi ${ctx.name}`,
		}));

		const { ctx } = await testMiddleware(mw, { baseCtx: { name: "world" } });

		expect(ctx).toEqual({ name: "world", greeting: "hi world" });
	});

	it("returns after function for middlewareWithAfter", async () => {
		const afterFn = vi.fn();

		const mw = middlewareWithAfter<{}>()(async () => withAfter({ startedAt: 123 }, afterFn));

		const { ctx, after } = await testMiddleware(mw);

		expect(ctx.startedAt).toBe(123);
		expect(after).toBe(afterFn);
	});

	it("returns undefined after for plain middleware", async () => {
		const mw = middleware<{}>()(async () => ({ a: 1 }));

		const { after } = await testMiddleware(mw);

		expect(after).toBeUndefined();
	});

	it("merges baseCtx with middleware output", async () => {
		const mw = middleware<{}>()(async () => ({ added: true }));

		const { ctx } = await testMiddleware(mw, { baseCtx: { existing: "yes" } });

		expect(ctx).toEqual({ existing: "yes", added: true });
	});
});
