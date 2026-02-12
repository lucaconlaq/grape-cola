import { testHandler } from "@lucaconlaq/grape-cola";
import { describe, expect, it } from "vitest";
import { signToken } from "../../../server/middlewares/withAuth.js";
import { authService } from "../../../server/services/auth/index.js";
import { createBaseCtx, makeHelloRequest } from "../../helpers.js";

const testUsers = [
	{ username: "alice", password: "password123" },
	{ username: "bob", password: "secret456" },
];

const baseCtx = (authorization?: string) => createBaseCtx({ data: { users: testUsers }, authorization });

describe("saySecretGreeting", () => {
	it("returns a personalized secret greeting for an authenticated user", async () => {
		const { reply } = await testHandler(authService.saySecretGreeting, {
			baseCtx: baseCtx(signToken("alice")),
			req: makeHelloRequest("42"),
		});

		expect(reply.getMessage()).toBe("psst, alice, the secret is: 42");
	});

	it("throws on missing authorization", async () => {
		await expect(
			testHandler(authService.saySecretGreeting, {
				baseCtx: baseCtx(undefined),
				req: makeHelloRequest("test"),
			}),
		).rejects.toThrow("missing authorization");
	});

	it("throws on invalid token", async () => {
		await expect(
			testHandler(authService.saySecretGreeting, {
				baseCtx: baseCtx("not-a-jwt"),
				req: makeHelloRequest("test"),
			}),
		).rejects.toThrow("invalid token");
	});

	it("throws when token references a nonexistent user", async () => {
		await expect(
			testHandler(authService.saySecretGreeting, {
				baseCtx: baseCtx(signToken("unknown")),
				req: makeHelloRequest("test"),
			}),
		).rejects.toThrow("user not found");
	});
});
