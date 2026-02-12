import { HelloReply, HelloRequest } from "../../gen/greeter_pb.js";
import { handler } from "../../handler.js";

const chatHello = handler()
	.request(HelloRequest)
	.reply(HelloReply)
	.bidiStream(async ({ ctx, call }) => {
		for await (const req of call) {
			const reply = new HelloReply();
			reply.setMessage(`${ctx.message}, ${req.getName()}!`);
			call.write(reply);
		}
	});

export { chatHello };
