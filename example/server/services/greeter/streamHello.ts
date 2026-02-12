import { HelloReply, HelloRequest } from "../../gen/greeter_pb.js";
import { handler } from "../../handler.js";

const streamHello = handler()
	.request(HelloRequest)
	.reply(HelloReply)
	.serverStream(async ({ req, ctx, call }) => {
		const name = req.getName();
		for (let i = 1; i <= 3; i++) {
			const reply = new HelloReply();
			reply.setMessage(`hello ${name}! (${i})`);
			await ctx.clock.sleep(1000);
			call.write(reply);
		}
	});

export { streamHello };
