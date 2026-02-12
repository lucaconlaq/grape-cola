import { LoginReply, LoginRequest } from "../../gen/auth_pb.js";
import { handler } from "../../handler.js";
import { signToken } from "../../middlewares/withAuth.js";
import { withDb } from "../../middlewares/withDb.js";

const login = handler()
	.use(withDb())
	.request(LoginRequest)
	.reply(LoginReply)
	.unary(async ({ req, ctx }) => {
		const user = ctx.db.findUser(req.getUsername());
		if (!user || user.password !== req.getPassword()) {
			throw new Error("invalid credentials");
		}

		const reply = new LoginReply();
		reply.setToken(signToken(user.username));
		return reply;
	});

export { login };
