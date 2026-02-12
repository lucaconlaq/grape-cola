import { createServer } from "@lucaconlaq/grape-cola";
import { AuthService } from "./gen/auth_grpc_pb.js";
import { GreeterService } from "./gen/greeter_grpc_pb.js";
import { handler } from "./handler.js";
import { authService } from "./services/auth/index.js";
import { greeterService } from "./services/greeter/index.js";

const PORT = "50051";
const HOST = "0.0.0.0";

const main = async () => {
	const server = createServer({
		handler,
		onStart: ({ ctx, error }) => {
			if (error) {
				ctx.logger.error("🚨 failed to start server");
				throw error;
			}
			ctx.logger.info("🚀 server listening on ${HOST}:${PORT}");
		},
	});

	server.addService(GreeterService, greeterService);
	server.addService(AuthService, authService);
	await server.listen(HOST, Number(PORT));
};

main();
