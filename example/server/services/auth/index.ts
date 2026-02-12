import { createService } from "@lucaconlaq/grape-cola";
import type { AuthService } from "../../gen/auth_grpc_pb.js";
import { login } from "./login.js";
import { saySecretGreeting } from "./saySecretGreeting.js";

const authService = createService<typeof AuthService>({
	login,
	saySecretGreeting,
});

export { authService };
