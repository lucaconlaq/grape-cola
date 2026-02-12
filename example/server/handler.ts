import {
	createHandler,
	injectGRPCLoggingContext,
	withClock,
	withGRPCLogging,
	withLogger,
} from "@lucaconlaq/grape-cola";
import { injectAuthContext } from "./middlewares/withAuth.js";

const handler = createHandler({
	injectInContext: [() => ({ message: "Hello" }), injectGRPCLoggingContext, injectAuthContext],
	defaultMiddleware: [withLogger(), withClock(), withGRPCLogging()],
});

export { handler };
