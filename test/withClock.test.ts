import { describe, expect, it } from "vitest";
import { immediateClock, testMiddleware, withClock } from "../src/index.js";

describe("withClock", () => {
	it("returns realClock when no clock in context", async () => {
		const { ctx } = await testMiddleware(withClock());

		expect(typeof ctx.clock.sleep).toBe("function");
		expect(typeof ctx.clock.now()).toBe("number");
		expect(ctx.clock.now()).toBeGreaterThan(0);
	});

	it("preserves existing clock from context", async () => {
		const { ctx } = await testMiddleware(withClock(), { baseCtx: { clock: immediateClock } });

		expect(ctx.clock).toBe(immediateClock);
		expect(ctx.clock.now()).toBe(0);
	});

	it("immediateClock.sleep resolves instantly", async () => {
		await immediateClock.sleep(5000);
	});
});
