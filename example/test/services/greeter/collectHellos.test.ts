import { testHandler } from "@lucaconlaq/grape-cola";
import { describe, expect, it } from "vitest";
import { greeterService } from "../../../server/services/greeter/index.js";
import { createBaseCtx, makeHelloRequest } from "../../helpers.js";

describe("collectHellos", () => {
	it("collects streamed requests and returns combined reply", async () => {
		const { reply } = await testHandler(greeterService.collectHellos, {
			baseCtx: createBaseCtx(),
			streamInput: [makeHelloRequest("alice"), makeHelloRequest("bob"), makeHelloRequest("charlie")],
		});

		expect(reply.getMessage()).toBe("hello, alice & bob & charlie!");
	});

	it("handles an empty stream", async () => {
		const { reply } = await testHandler(greeterService.collectHellos, {
			baseCtx: createBaseCtx(),
			streamInput: [],
		});

		expect(reply.getMessage()).toBe("hello, !");
	});
});
