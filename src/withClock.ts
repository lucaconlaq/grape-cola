import { middleware } from "./middleware.js";

/** An injectable time abstraction for sleeping and getting the current time. */
type Clock = {
	sleep: (ms: number) => Promise<void>;
	now: () => number;
};

const realClock: Clock = {
	sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
	now: () => Date.now(),
};

/**
 * A {@link Clock} that resolves `sleep()` instantly and returns `0` from `now()`.
 * Useful in tests to avoid real timers.
 *
 * @example
 * ```ts
 * const { ctx } = await testMiddleware(withClock(), {
 *   baseCtx: { clock: immediateClock },
 * });
 * // ctx.clock.now() === 0
 * ```
 */
const immediateClock: Clock = {
	sleep: async () => {},
	now: () => 0,
};

/**
 * Provides a {@link Clock} abstraction in context.
 *
 * If `clock` is already present in the context it is preserved, allowing
 * tests to inject a fake (e.g. {@link immediateClock}) and run without
 * side-effects.
 *
 * @example
 * ```ts
 * const handler = createHandler({
 *   defaultMiddleware: [withClock()],
 * });
 * ```
 */
const withClock = () =>
	middleware<{ clock?: Clock }>()<{ clock: Clock }>(async ({ ctx }) => ({
		clock: ctx.clock ?? realClock,
	}));

export type { Clock };
export { withClock, immediateClock };
