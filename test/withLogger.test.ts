import type { Logger } from "pino";
import { describe, expect, it } from "vitest";
import { testMiddleware, withLogger } from "../src/index.js";

describe("withLogger", () => {
	it("returns a logger when no logger in context", async () => {
		const { ctx } = await testMiddleware(withLogger());

		expect(ctx.logger).toBeDefined();
		expect(typeof ctx.logger.info).toBe("function");
		expect(typeof ctx.logger.error).toBe("function");
		expect(typeof ctx.logger.warn).toBe("function");
	});

	it("preserves existing logger from context", async () => {
		const existing = { info: () => {}, error: () => {}, warn: () => {} } as unknown as Logger;

		const { ctx } = await testMiddleware(withLogger(), { baseCtx: { logger: existing } });

		expect(ctx.logger).toBe(existing);
	});
});
