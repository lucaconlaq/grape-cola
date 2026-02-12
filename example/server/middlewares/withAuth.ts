import { middleware } from "@lucaconlaq/grape-cola";
import type { GrpcCall } from "@lucaconlaq/grape-cola";
import jwt from "jsonwebtoken";
import type { Db, User } from "./withDb.js";

const JWT_SECRET = "super-secret-key";

const injectAuthContext = (call?: GrpcCall) => {
	const authorization = call?.metadata.get("authorization")[0]?.toString();
	return { authorization };
};

const signToken = (username: string): string => {
	return jwt.sign({ username }, JWT_SECRET);
};

const withAuth = () =>
	middleware<{ db: Db; authorization?: string }>()<{ user: User }>(async ({ ctx }) => {
		if (!ctx.authorization) throw new Error("missing authorization");

		let payload: { username: string };
		try {
			payload = jwt.verify(ctx.authorization, JWT_SECRET) as { username: string };
		} catch {
			throw new Error("invalid token");
		}

		const user = ctx.db.findUser(payload.username);
		if (!user) throw new Error("user not found");
		return { user };
	});

export type { User };
export { injectAuthContext, withAuth, signToken };
