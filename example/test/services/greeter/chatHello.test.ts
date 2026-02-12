import { testHandler } from "@lucaconlaq/grape-cola";
import { describe, expect, it } from "vitest";
import { greeterService } from "../../../server/services/greeter/index.js";
import { createBaseCtx, makeHelloRequest } from "../../helpers.js";

describe("chatHello", () => {
	it("writes a reply for each received request", async () => {
		const { output } = await testHandler(greeterService.chatHello, {
			baseCtx: createBaseCtx(),
			streamInput: [makeHelloRequest("alice"), makeHelloRequest("bob")],
		});

		expect(output).toHaveLength(2);
		expect(output?.[0].getMessage()).toBe("hello, alice!");
		expect(output?.[1].getMessage()).toBe("hello, bob!");
	});

	it("uses the message from context", async () => {
		const { output } = await testHandler(greeterService.chatHello, {
			baseCtx: createBaseCtx({ message: "hey" }),
			streamInput: [makeHelloRequest("alice")],
		});

		expect(output?.[0].getMessage()).toBe("hey, alice!");
	});

	it("handles an empty stream", async () => {
		const { output } = await testHandler(greeterService.chatHello, {
			baseCtx: createBaseCtx(),
			streamInput: [],
		});

		expect(output).toHaveLength(0);
	});
});
