import { testHandler } from "@lucaconlaq/grape-cola";
import { describe, expect, it } from "vitest";
import { greeterService } from "../../../server/services/greeter/index.js";
import { createBaseCtx, makeHelloRequest } from "../../helpers.js";

describe("sayHello", () => {
	it("returns a greeting with the name", async () => {
		const { reply } = await testHandler(greeterService.sayHello, {
			baseCtx: createBaseCtx(),
			req: makeHelloRequest("world"),
		});

		expect(reply.getMessage()).toBe("hello, world!");
	});

	it("handles an empty name", async () => {
		const { reply } = await testHandler(greeterService.sayHello, {
			baseCtx: createBaseCtx(),
			req: makeHelloRequest(""),
		});

		expect(reply.getMessage()).toBe("hello, !");
	});
});
