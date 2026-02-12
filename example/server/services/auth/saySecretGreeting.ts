import { HelloReply, HelloRequest } from "../../gen/greeter_pb.js";
import { handler } from "../../handler.js";
import { withAuth } from "../../middlewares/withAuth.js";
import { withDb } from "../../middlewares/withDb.js";

const saySecretGreeting = handler()
	.use(withDb())
	.use(withAuth())
	.request(HelloRequest)
	.reply(HelloReply)
	.unary(async ({ req, ctx }) => {
		const reply = new HelloReply();
		reply.setMessage(`psst, ${ctx.user.username}, the secret is: ${req.getName()}`);
		return reply;
	});

export { saySecretGreeting };
