import type { Logger } from "pino";
import pino from "pino";
import pinoPretty from "pino-pretty";
import { middleware } from "./middleware.js";

const createLogger = (): Logger => {
	return pino(pinoPretty());
};

/**
 * Provides a pino {@link Logger} in context.
 *
 * If `logger` is already present in the context it is preserved, allowing
 * tests to inject a silent logger and run without noisy output.
 *
 * Requires `pino` and `pino-pretty` as peer dependencies.
 *
 * @example
 * ```ts
 * const handler = createHandler({
 *   defaultMiddleware: [withLogger()],
 * });
 * ```
 */
const withLogger = () =>
	middleware<{ logger?: Logger }>()<{ logger: Logger }>(async ({ ctx }) => ({
		logger: ctx.logger ?? createLogger(),
	}));

export { withLogger };
