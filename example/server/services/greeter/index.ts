import { createService } from "@lucaconlaq/grape-cola";
import type { GreeterService } from "../../gen/greeter_grpc_pb.js";
import { chatHello } from "./chatHello.js";
import { collectHellos } from "./collectHellos.js";
import { sayHello } from "./sayHello.js";
import { sayHelloReversed } from "./sayHelloReversed.js";
import { streamHello } from "./streamHello.js";

const greeterService = createService<typeof GreeterService>({
	sayHello,
	sayHelloReversed,
	streamHello,
	collectHellos,
	chatHello,
});

export { greeterService };
