import type { AfterFn, MiddlewareFn, MiddlewareWithAfterFn } from "./types.js";

/**
 * Define a reusable middleware with typed context requirements.
 *
 * Call with the required context type, then pass the middleware function.
 * TypeScript enforces that the handler's context satisfies the requirement.
 *
 * @example
 * ```ts
 * const withAuth = middleware<{ db: Database }>()(async ({ ctx }) => {
 *   const user = await ctx.db.users.findByToken(ctx.authToken);
 *   return { user };
 * });
 * ```
 */
const middleware = <TCtxIn>(): (<TCtxOut>(
	fn: (opts: { ctx: TCtxIn }) => Promise<TCtxOut>,
) => MiddlewareFn<TCtxIn, TCtxOut>) => {
	return (fn) => fn as any;
};

/**
 * Like {@link middleware} but the returned function must also return an
 * {@link AfterFn} via {@link withAfter}. The after function runs after the
 * handler completes, in reverse middleware order.
 *
 * @example
 * ```ts
 * const withTiming = middlewareWithAfter<{ logger: Logger }>()(async ({ ctx }) => {
 *   const start = Date.now();
 *   return withAfter({ start }, () => ctx.logger.info(`took ${Date.now() - start}ms`));
 * });
 * ```
 */
const middlewareWithAfter = <TCtxIn>(): (<TCtxOut>(
	fn: (opts: { ctx: TCtxIn }) => Promise<readonly [TCtxOut, AfterFn]>,
) => MiddlewareWithAfterFn<TCtxIn, TCtxOut>) => {
	return (fn) => fn as any;
};

/**
 * Pair context fields with a cleanup function. Used inside
 * {@link middlewareWithAfter} middleware to return both.
 *
 * @example
 * ```ts
 * return withAfter({ startedAt: Date.now() }, () => console.log("done"));
 * ```
 */
const withAfter = <T>(ctx: T, after: AfterFn): readonly [T, AfterFn] => {
	return [ctx, after];
};

export { middleware, middlewareWithAfter, withAfter };
