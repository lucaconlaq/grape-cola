import type { Logger } from "pino";
import { describe, expect, it } from "vitest";
import { immediateClock, testMiddleware, withGRPCLogging } from "../src/index.js";

const createBaseCtx = (overrides?: Record<string, unknown>) => ({
	logger: { info: () => {} } as unknown as Logger,
	clock: immediateClock,
	request: { id: "test-123", path: "/TestService/testMethod" },
	...overrides,
});

const createSpyLogger = () => {
	const messages: string[] = [];
	const logger = { info: (msg: string) => messages.push(msg) } as unknown as Logger;
	return { logger, messages };
};

describe("withGRPCLogging", () => {
	it("logs path when request is present", async () => {
		const { logger, messages } = createSpyLogger();

		const { after } = await testMiddleware(withGRPCLogging(), {
			baseCtx: createBaseCtx({ logger }),
		});
		after?.();

		expect(messages).toHaveLength(1);
		expect(messages[0]).toBe("✅ [/TestService/testMethod] completed in 0ms");
	});

	it("logs unknown request when request is undefined", async () => {
		const { logger, messages } = createSpyLogger();

		const { after } = await testMiddleware(withGRPCLogging(), {
			baseCtx: createBaseCtx({ logger, request: undefined }),
		});
		// biome-ignore lint/suspicious/noDuplicateTestHooks: `after` is a variable, not a test hook
		after?.();

		expect(messages).toHaveLength(1);
		expect(messages[0]).toBe("🤷‍♂️ unknown request completed in 0ms");
	});
});
