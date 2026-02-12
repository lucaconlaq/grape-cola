import { middleware } from "@lucaconlaq/grape-cola";

type User = {
	username: string;
	password: string;
};

type Db = {
	findUser: (username: string) => User | undefined;
};

type DbData = {
	users: User[];
};

const defaultData: DbData = {
	users: [
		{ username: "alice", password: "password123" },
		{ username: "bob", password: "secret456" },
		{ username: "charlie", password: "hunter2" },
	],
};

const withDb = () =>
	middleware<{ data?: Partial<DbData>; [key: string]: unknown }>()<{ db: Db }>(async ({ ctx }) => {
		const data: DbData = { ...defaultData, ...ctx.data };
		return {
			db: {
				findUser: (username: string) => data.users.find((u) => u.username === username),
			},
		};
	});

export type { User, Db, DbData };
export { withDb };
