import { immediateClock, testHandler } from "@lucaconlaq/grape-cola";
import { describe, expect, it, vi } from "vitest";
import { greeterService } from "../../../server/services/greeter/index.js";
import { createBaseCtx, makeHelloRequest } from "../../helpers.js";

describe("streamHello", () => {
	it("writes multiple replies to the stream", async () => {
		const { output } = await testHandler(greeterService.streamHello, {
			baseCtx: createBaseCtx(),
			req: makeHelloRequest("world"),
		});

		expect(output).toHaveLength(3);
		expect(output?.[0].getMessage()).toBe("hello world! (1)");
		expect(output?.[1].getMessage()).toBe("hello world! (2)");
		expect(output?.[2].getMessage()).toBe("hello world! (3)");
	});

	it("sleeps between each message", async () => {
		const sleep = vi.fn().mockResolvedValue(undefined);

		await testHandler(greeterService.streamHello, {
			baseCtx: createBaseCtx({ clock: { ...immediateClock, sleep } }),
			req: makeHelloRequest("world"),
		});

		expect(sleep).toHaveBeenCalledTimes(3);
		expect(sleep).toHaveBeenCalledWith(1000);
	});
});
