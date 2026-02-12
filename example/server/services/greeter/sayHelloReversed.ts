import { HelloReply, HelloRequest } from "../../gen/greeter_pb.js";
import { handler } from "../../handler.js";

const sayHelloReversed = handler()
	.request(HelloRequest)
	.reply(HelloReply)
	.unary(async ({ req }) => {
		const reply = new HelloReply();
		const reversed = `hello, ${req.getName()}!`.split("").reverse().join("");
		reply.setMessage(reversed);
		return reply;
	});

export { sayHelloReversed };
