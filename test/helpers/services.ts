import type { MethodDefinition, ServiceDefinition } from "@grpc/grpc-js";
import type { TaskReply, TaskRequest } from "./messages.js";

// --- Fake method definition builder (binary stub) ---

export const fakeMethod = <Req, Res>(opts: {
	requestStream: boolean;
	responseStream: boolean;
}): MethodDefinition<Req, Res> => ({
	path: "/test/Method",
	requestStream: opts.requestStream,
	responseStream: opts.responseStream,
	requestSerialize: (v: Req) => Buffer.from(""),
	requestDeserialize: (b: Buffer) => ({}) as Req,
	responseSerialize: (v: Res) => Buffer.from(""),
	responseDeserialize: (b: Buffer) => ({}) as Res,
});

// --- JSON method definition (for end-to-end tests) ---

export const jsonMethod = <Req, Res>(): MethodDefinition<Req, Res> => ({
	path: "/test.TestService/Echo",
	requestStream: false,
	responseStream: false,
	requestSerialize: (v: Req) => Buffer.from(JSON.stringify(v)),
	requestDeserialize: (b: Buffer) => JSON.parse(b.toString()) as Req,
	responseSerialize: (v: Res) => Buffer.from(JSON.stringify(v)),
	responseDeserialize: (b: Buffer) => JSON.parse(b.toString()) as Res,
});

// --- Fake service definitions ---

export const UnaryServiceDef = {
	createTask: fakeMethod<TaskRequest, TaskReply>({
		requestStream: false,
		responseStream: false,
	}),
} as const satisfies ServiceDefinition;

export const StreamingServiceDef = {
	listTasks: fakeMethod<TaskRequest, TaskReply>({
		requestStream: false,
		responseStream: true,
	}),
	importTasks: fakeMethod<TaskRequest, TaskReply>({
		requestStream: true,
		responseStream: false,
	}),
	syncTasks: fakeMethod<TaskRequest, TaskReply>({
		requestStream: true,
		responseStream: true,
	}),
} as const satisfies ServiceDefinition;

export const MixedServiceDef = {
	createTask: fakeMethod<TaskRequest, TaskReply>({
		requestStream: false,
		responseStream: false,
	}),
	listTasks: fakeMethod<TaskRequest, TaskReply>({
		requestStream: false,
		responseStream: true,
	}),
} as const satisfies ServiceDefinition;

export const TestServiceDef = {
	echo: jsonMethod<{ id: string }, { title: string }>(),
} as const satisfies ServiceDefinition;
