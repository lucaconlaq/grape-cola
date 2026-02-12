import type { Metadata } from "@grpc/grpc-js";

type Simplify<T> = { [K in keyof T]: T[K] } & {};
type MergeContext<TBase, TNew> = Simplify<Omit<TBase, keyof TNew> & TNew>;

/** Subset of a gRPC call exposed to {@link InjectFn} functions. */
type GrpcCall = {
	metadata: Metadata;
	getPath(): string;
};

/** Cleanup function returned by {@link middlewareWithAfter} middleware. Runs after the handler completes, in reverse order. */
type AfterFn = () => void | Promise<void>;

/** The four gRPC communication patterns. */
type CallType = "unary" | "serverStream" | "clientStream" | "bidiStream";

/**
 * A middleware function that receives the current context and returns new
 * fields to merge into it.
 *
 * @example
 * ```ts
 * const withLogger = middleware<{}>()(async () => {
 *   return { logger: createLogger() };
 * });
 * ```
 */
type MiddlewareFn<TCtxIn = any, TCtxOut = any> = (opts: {
	ctx: TCtxIn;
}) => Promise<TCtxOut>;

/**
 * Like {@link MiddlewareFn} but also returns an {@link AfterFn} that runs
 * after the handler completes. Use {@link withAfter} to build the return tuple.
 *
 * @example
 * ```ts
 * const withTiming = middlewareWithAfter<{ logger: Logger }>()(async ({ ctx }) => {
 *   const start = Date.now();
 *   return withAfter({ start }, () => ctx.logger.info(`took ${Date.now() - start}ms`));
 * });
 * ```
 */
type MiddlewareWithAfterFn<TCtxIn = any, TCtxOut = any> = (opts: {
	ctx: TCtxIn;
}) => Promise<readonly [TCtxOut, AfterFn]>;

/**
 * A function that extracts values from the raw gRPC call and returns fields
 * to merge into the base context. Passed as `injectInContext` to {@link createHandler}.
 */
type InjectFn<TOut = any> = (call?: GrpcCall) => TOut;

/**
 * A finalized handler produced by the builder chain. Carries the RPC type,
 * accumulated middleware, and the handler function.
 */
interface ResolvedHandler<TReq = any, TRes = any, TType extends CallType = CallType> {
	__brand: "grape-cola-handler";
	__type: TType;
	middlewares: (MiddlewareFn | MiddlewareWithAfterFn)[];
	fn: (opts: any) => Promise<any>;
}

type InferMiddlewareOutput<T> = T extends MiddlewareWithAfterFn<any, infer Out>
	? Out
	: T extends MiddlewareFn<any, infer Out>
		? Out
		: {};

type AccumulateContext<TBase, TMW extends any[]> = TMW extends [infer Head, ...infer Tail]
	? AccumulateContext<MergeContext<TBase, InferMiddlewareOutput<Head>>, Tail>
	: TBase;

type AccumulateInject<T extends any[]> = T extends [InjectFn<infer Out>, ...infer Tail]
	? AccumulateInject<Tail> extends infer Rest
		? MergeContext<Rest & {}, Out>
		: never
	: {};

export type {
	AccumulateContext,
	AccumulateInject,
	AfterFn,
	CallType,
	GrpcCall,
	InjectFn,
	MergeContext,
	MiddlewareFn,
	MiddlewareWithAfterFn,
	ResolvedHandler,
};
