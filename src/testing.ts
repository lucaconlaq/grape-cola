import type { AfterFn, CallType, MergeContext, MiddlewareFn, MiddlewareWithAfterFn, ResolvedHandler } from "./types.js";

/**
 * Run a {@link ResolvedHandler} without starting a gRPC server.
 *
 * For unary/clientStream handlers the result contains `reply`.
 * For serverStream/bidiStream handlers the result contains `output` (collected writes).
 *
 * @example
 * ```ts
 * const { reply } = await testHandler(sayHello, { req: new HelloRequest() });
 * expect(reply.getMessage()).toBe("Hello, world!");
 * ```
 */
async function testHandler<TReq, TRes, TType extends CallType>(
	handler: ResolvedHandler<TReq, TRes, TType>,
	opts?: {
		baseCtx?: Record<string, unknown>;
		req?: TReq;
		streamInput?: TReq[];
	},
): Promise<
	TType extends "unary" | "clientStream"
		? { reply: TRes }
		: TType extends "serverStream" | "bidiStream"
			? { output: TRes[] }
			: { reply?: TRes; output?: TRes[] }
>;
async function testHandler(
	handler: ResolvedHandler,
	opts: {
		baseCtx?: Record<string, unknown>;
		req?: any;
		streamInput?: any[];
	} = {},
): Promise<{ reply?: any; output?: any[] }> {
	const output: any[] = [];
	const { ctx, afters } = await resolveContext(opts.baseCtx ?? {}, ...handler.middlewares);

	let call: any;
	switch (handler.__type) {
		case "unary":
			call = {};
			break;
		case "serverStream":
			call = { write: (msg: any) => output.push(msg) };
			break;
		case "clientStream": {
			const items = opts.streamInput ?? [];
			call = {
				[Symbol.asyncIterator]: async function* () {
					for (const item of items) yield item;
				},
			};
			break;
		}
		case "bidiStream": {
			const items = opts.streamInput ?? [];
			call = {
				[Symbol.asyncIterator]: async function* () {
					for (const item of items) yield item;
				},
				write: (msg: any) => output.push(msg),
			};
			break;
		}
	}

	let reply: any;
	if (handler.__type === "unary" || handler.__type === "serverStream") {
		reply = await handler.fn({ req: opts.req, ctx, call });
	} else {
		reply = await handler.fn({ ctx, call });
	}

	for (let i = afters.length - 1; i >= 0; i--) {
		await afters[i]();
	}

	if (handler.__type === "unary" || handler.__type === "clientStream") {
		return { reply };
	}
	return { output };
}

/**
 * Run a single middleware in isolation and return the merged context.
 * If the middleware is a {@link MiddlewareWithAfterFn}, the `after` function
 * is also returned.
 *
 * @example
 * ```ts
 * const { ctx, after } = await testMiddleware(withTiming, { baseCtx: { logger } });
 * expect(ctx.start).toBeDefined();
 * ```
 */
async function testMiddleware<TOut, TBase extends Record<string, unknown> = {}>(
	mw: MiddlewareFn<any, TOut> | MiddlewareWithAfterFn<any, TOut>,
	opts?: { baseCtx?: TBase },
): Promise<{ ctx: MergeContext<TBase, TOut>; after?: AfterFn }>;
async function testMiddleware(
	mw: MiddlewareFn | MiddlewareWithAfterFn,
	opts: { baseCtx?: Record<string, unknown> } = {},
): Promise<{ ctx: any; after?: AfterFn }> {
	const baseCtx = opts.baseCtx ?? {};
	const result = await mw({ ctx: baseCtx });
	if (Array.isArray(result)) {
		return { ctx: { ...baseCtx, ...result[0] }, after: result[1] };
	}
	return { ctx: { ...baseCtx, ...result } };
}

const resolveContext = async (
	base: any,
	...middlewares: (MiddlewareFn | MiddlewareWithAfterFn)[]
): Promise<{ ctx: any; afters: AfterFn[] }> => {
	let ctx: any = base;
	const afters: AfterFn[] = [];

	for (const mw of middlewares) {
		const result = await mw({ ctx });
		if (Array.isArray(result)) {
			ctx = { ...ctx, ...result[0] };
			afters.push(result[1]);
		} else {
			ctx = { ...ctx, ...result };
		}
	}

	return { ctx, afters };
};

export { testHandler, testMiddleware, resolveContext };
