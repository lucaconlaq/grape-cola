import { describe, expect, it } from "vitest";
import { createHandler, createService } from "../src/index.js";
import { TaskReply, TaskRequest } from "./helpers/messages.js";
import type { MixedServiceDef, StreamingServiceDef, UnaryServiceDef } from "./helpers/services.js";

const makeHandler = () => createHandler({ injectInContext: [] });

describe("createService()", () => {
	it("accepts a valid unary service definition", () => {
		const service = createService<typeof UnaryServiceDef>({
			createTask: makeHandler()()
				.request(TaskRequest)
				.reply(TaskReply)
				.unary(async ({ req }) => {
					const reply = new TaskReply();
					reply.setTitle(`Task ${req.getId()}`);
					return reply;
				}),
		});

		expect(service).toBeDefined();
	});

	it("accepts all streaming kinds", () => {
		const service = createService<typeof StreamingServiceDef>({
			listTasks: makeHandler()()
				.request(TaskRequest)
				.reply(TaskReply)
				.serverStream(async ({ req, call }) => {
					call.write(new TaskReply());
				}),

			importTasks: makeHandler()()
				.request(TaskRequest)
				.reply(TaskReply)
				.clientStream(async ({ call }) => {
					return new TaskReply();
				}),

			syncTasks: makeHandler()()
				.request(TaskRequest)
				.reply(TaskReply)
				.bidiStream(async ({ call }) => {
					for await (const req of call) {
						call.write(new TaskReply());
					}
				}),
		});

		expect(service).toBeDefined();
	});

	it("accepts a mixed service with unary and streaming methods", () => {
		const service = createService<typeof MixedServiceDef>({
			createTask: makeHandler()()
				.request(TaskRequest)
				.reply(TaskReply)
				.unary(async () => new TaskReply()),

			listTasks: makeHandler()()
				.request(TaskRequest)
				.reply(TaskReply)
				.serverStream(async ({ call }) => {
					call.write(new TaskReply());
				}),
		});

		expect(service).toBeDefined();
	});

	it("returns the same handler map that was passed in", () => {
		const createTask = makeHandler()()
			.request(TaskRequest)
			.reply(TaskReply)
			.unary(async () => new TaskReply());

		const handlers = { createTask };
		const service = createService<typeof UnaryServiceDef>(handlers);

		expect(service).toBe(handlers);
	});
});
