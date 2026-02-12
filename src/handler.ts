import type { ServerDuplexStream, ServerReadableStream, ServerUnaryCall, ServerWritableStream } from "@grpc/grpc-js";
import type {
	AccumulateContext,
	AccumulateInject,
	AfterFn,
	InjectFn,
	MergeContext,
	MiddlewareFn,
	MiddlewareWithAfterFn,
	ResolvedHandler,
} from "./types.js";

// ---------------------------------------------------------------------------
// Builder chain (internal — returned by handler(), not exported by name)
// ---------------------------------------------------------------------------

/** Final step: request and reply types are set, pick the RPC kind. */
class BuilderWithReply<TCtx, TReq, TRes> {
	private _middlewares: (MiddlewareFn | MiddlewareWithAfterFn)[];

	constructor(middlewares: (MiddlewareFn | MiddlewareWithAfterFn)[]) {
		this._middlewares = middlewares;
	}

	/** Single request, single response. */
	unary(
		fn: (opts: { req: TReq; ctx: TCtx; call: ServerUnaryCall<TReq, TRes> }) => Promise<TRes>,
	): ResolvedHandler<TReq, TRes, "unary"> {
		return { __brand: "grape-cola-handler", __type: "unary", middlewares: this._middlewares, fn };
	}

	/** Single request, streamed responses. */
	serverStream(
		fn: (opts: { req: TReq; ctx: TCtx; call: ServerWritableStream<TReq, TRes> }) => Promise<void>,
	): ResolvedHandler<TReq, TRes, "serverStream"> {
		return { __brand: "grape-cola-handler", __type: "serverStream", middlewares: this._middlewares, fn };
	}

	/** Streamed requests, single response. */
	clientStream(
		fn: (opts: { ctx: TCtx; call: ServerReadableStream<TReq, TRes> }) => Promise<TRes>,
	): ResolvedHandler<TReq, TRes, "clientStream"> {
		return { __brand: "grape-cola-handler", __type: "clientStream", middlewares: this._middlewares, fn };
	}

	/** Streamed requests and responses. */
	bidiStream(
		fn: (opts: { ctx: TCtx; call: ServerDuplexStream<TReq, TRes> }) => Promise<void>,
	): ResolvedHandler<TReq, TRes, "bidiStream"> {
		return { __brand: "grape-cola-handler", __type: "bidiStream", middlewares: this._middlewares, fn };
	}
}

/** Intermediate step: request type is set, pick the reply type. */
class BuilderWithRequest<TCtx, TReq> {
	private _middlewares: (MiddlewareFn | MiddlewareWithAfterFn)[];

	constructor(middlewares: (MiddlewareFn | MiddlewareWithAfterFn)[]) {
		this._middlewares = middlewares;
	}

	/** Set the response message type. */
	reply<TRes>(_Class: new (...args: any[]) => TRes): BuilderWithReply<TCtx, TReq, TRes> {
		return new BuilderWithReply<TCtx, TReq, TRes>(this._middlewares);
	}
}

/** Entry step: add middleware with `.use()` or set the request type with `.request()`. */
class Builder<TCtx> {
	private _middlewares: (MiddlewareFn | MiddlewareWithAfterFn)[];

	constructor(middlewares: (MiddlewareFn | MiddlewareWithAfterFn)[] = []) {
		this._middlewares = middlewares;
	}

	/**
	 * Append middleware to this handler. Returns a new builder with the
	 * extended context type — the original is not mutated.
	 */
	use<TOut>(fn: (opts: { ctx: TCtx }) => Promise<readonly [TOut, AfterFn]>): Builder<MergeContext<TCtx, TOut>>;
	use<TOut>(fn: (opts: { ctx: TCtx }) => Promise<TOut>): Builder<MergeContext<TCtx, TOut>>;
	use(fn: (opts: { ctx: TCtx }) => Promise<any>): Builder<any> {
		return new Builder([...this._middlewares, fn]);
	}

	/** Set the request message type. */
	request<TReq>(_Class: new (...args: any[]) => TReq): BuilderWithRequest<TCtx, TReq> {
		return new BuilderWithRequest<TCtx, TReq>(this._middlewares);
	}
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * A callable handler factory. Calling `handler()` starts the builder chain.
 *
 * Also carries the `injectInContext` and `defaultMiddleware` arrays so that
 * {@link createServer} can read them.
 */
interface Handler<TCtx> {
	(): Builder<TCtx>;
	injectInContext: InjectFn[];
	defaultMiddleware: (MiddlewareFn | MiddlewareWithAfterFn)[];
}

/**
 * Create a handler factory with context injection and shared middleware.
 *
 * The context type is inferred from `injectInContext` and `defaultMiddleware`
 * — each entry extends the context seen by the next.
 *
 * @example
 * ```ts
 * const handler = createHandler({
 *   injectInContext: [() => ({ requestId: crypto.randomUUID() })],
 *   defaultMiddleware: [withLogger()],
 * });
 *
 * const sayHello = handler()
 *   .request(HelloRequest)
 *   .reply(HelloReply)
 *   .unary(async ({ req, ctx }) => { ... });
 * ```
 */
function createHandler<
	const TInject extends InjectFn[],
	const TMW extends (MiddlewareFn | MiddlewareWithAfterFn)[],
>(options: {
	injectInContext: [...TInject];
	defaultMiddleware?: [...TMW];
}): Handler<AccumulateContext<AccumulateInject<TInject>, TMW>>;
function createHandler(options: {
	injectInContext: InjectFn[];
	defaultMiddleware?: (MiddlewareFn | MiddlewareWithAfterFn)[];
}): Handler<any> {
	const mw = options.defaultMiddleware ?? [];
	const handler = (() => new Builder(mw)) as Handler<any>;
	handler.injectInContext = options.injectInContext;
	handler.defaultMiddleware = mw;
	return handler;
}

export type { Handler };
export { createHandler };
