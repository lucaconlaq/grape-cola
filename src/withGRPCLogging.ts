import type { Logger } from "pino";
import { middlewareWithAfter, withAfter } from "./middleware.js";
import type { GrpcCall } from "./types.js";
import type { Clock } from "./withClock.js";

type WithLoggingContext = {
	request?: {
		id: string;
		path: string;
	};
};

/**
 * Extracts a request ID and path from a gRPC call's metadata.
 *
 * Pass as an `injectInContext` function to {@link createHandler} so that
 * {@link withGRPCLogging} can log per-request details.
 *
 * @example
 * ```ts
 * const handler = createHandler({
 *   injectInContext: [injectGRPCLoggingContext],
 *   defaultMiddleware: [withLogger(), withClock(), withGRPCLogging()],
 * });
 * ```
 */
const injectGRPCLoggingContext = (call?: GrpcCall): WithLoggingContext => {
	let request: WithLoggingContext["request"] | undefined;

	if (call) {
		const id = call.metadata.get("x-request-id")[0]?.toString() ?? crypto.randomUUID();
		const path = call.getPath();
		request = { id, path };
	}

	return {
		request,
	};
};

/**
 * Logs request duration after the handler completes.
 *
 * Requires `withClock` and `withLogger` (or equivalent `clock` and `logger`
 * fields) earlier in the middleware chain, and optionally
 * {@link injectGRPCLoggingContext} in `injectInContext` for per-request details.
 *
 * @example
 * ```ts
 * const handler = createHandler({
 *   injectInContext: [injectGRPCLoggingContext],
 *   defaultMiddleware: [withLogger(), withClock(), withGRPCLogging()],
 * });
 * ```
 */
const withGRPCLogging = () =>
	middlewareWithAfter<WithLoggingContext & { clock: Clock; logger: Logger }>()(async ({ ctx }) => {
		const startedAt = ctx.clock.now();

		return withAfter({}, () => {
			const duration = ctx.clock.now() - startedAt;
			if (ctx.request) {
				ctx.logger.info(`✅ [${ctx.request.path}] completed in ${duration}ms`);
			} else {
				ctx.logger.info(`🤷‍♂️ unknown request completed in ${duration}ms`);
			}
		});
	});

export { withGRPCLogging, injectGRPCLoggingContext };
