import { testHandler } from "@lucaconlaq/grape-cola";
import { describe, expect, it } from "vitest";
import { greeterService } from "../../../server/services/greeter/index.js";
import { createBaseCtx, makeHelloRequest } from "../../helpers.js";

describe("sayHelloReversed", () => {
	it("returns a reversed greeting", async () => {
		const { reply } = await testHandler(greeterService.sayHelloReversed, {
			baseCtx: createBaseCtx(),
			req: makeHelloRequest("world"),
		});

		expect(reply.getMessage()).toBe("!dlrow ,olleh");
	});

	it("handles an empty name", async () => {
		const { reply } = await testHandler(greeterService.sayHelloReversed, {
			baseCtx: createBaseCtx(),
			req: makeHelloRequest(""),
		});

		expect(reply.getMessage()).toBe("! ,olleh");
	});
});
