import { HelloReply, HelloRequest } from "../../gen/greeter_pb.js";
import { handler } from "../../handler.js";

const sayHello = handler()
	.request(HelloRequest)
	.reply(HelloReply)
	.unary(async ({ req }) => {
		const reply = new HelloReply();
		reply.setMessage(`hello, ${req.getName()}!`);
		return reply;
	});

export { sayHello };
