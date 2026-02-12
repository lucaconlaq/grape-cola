import { immediateClock } from "@lucaconlaq/grape-cola";
import pino from "pino";
import { HelloRequest } from "../server/gen/greeter_pb.js";

const createBaseCtx = (overrides?: Record<string, unknown>) => ({
	logger: pino({ level: "silent" }),
	clock: immediateClock,
	message: "hello",
	request: { id: "test-123", path: "/TestService/testMethod" },
	...overrides,
});

const makeHelloRequest = (name: string) => {
	const helloRequest = new HelloRequest();
	helloRequest.setName(name);
	return helloRequest;
};

export { createBaseCtx, makeHelloRequest };
