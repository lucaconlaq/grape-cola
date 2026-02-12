import { testHandler } from "@lucaconlaq/grape-cola";
import { describe, expect, it } from "vitest";
import { LoginRequest } from "../../../server/gen/auth_pb.js";
import { authService } from "../../../server/services/auth/index.js";
import { createBaseCtx } from "../../helpers.js";

const testUsers = [
	{ username: "alice", password: "password123" },
	{ username: "bob", password: "secret456" },
];

const baseCtx = createBaseCtx({ data: { users: testUsers } });

const makeLoginRequest = (username: string, password: string) => {
	const loginRequest = new LoginRequest();
	loginRequest.setUsername(username);
	loginRequest.setPassword(password);
	return loginRequest;
};

describe("login", () => {
	it("returns a token for valid credentials", async () => {
		const { reply } = await testHandler(authService.login, {
			baseCtx,
			req: makeLoginRequest("alice", "password123"),
		});

		expect(reply.getToken()).toBeTypeOf("string");
		expect(reply.getToken().length).toBeGreaterThan(0);
	});

	it("throws on wrong password", async () => {
		await expect(
			testHandler(authService.login, {
				baseCtx,
				req: makeLoginRequest("alice", "wrong"),
			}),
		).rejects.toThrow("invalid credentials");
	});

	it("throws on unknown user", async () => {
		await expect(
			testHandler(authService.login, {
				baseCtx,
				req: makeLoginRequest("unknown", "password123"),
			}),
		).rejects.toThrow("invalid credentials");
	});
});
