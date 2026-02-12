import { HelloReply, HelloRequest } from "../../gen/greeter_pb.js";
import { handler } from "../../handler.js";

const collectHellos = handler()
	.request(HelloRequest)
	.reply(HelloReply)
	.clientStream(async ({ ctx, call }) => {
		const names: string[] = [];
		for await (const req of call) {
			names.push(req.getName());
		}
		const reply = new HelloReply();
		reply.setMessage(`hello, ${names.join(" & ")}!`);
		return reply;
	});

export { collectHellos };
