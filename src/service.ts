import type { MethodDefinition, ServiceDefinition } from "@grpc/grpc-js";
import type { ResolvedHandler } from "./types.js";

/** Filters out index-signature keys (`string`, `number`, `symbol`), keeping only literal keys. */
type LiteralKeys<T> = keyof {
	[K in keyof T as string extends K ? never : number extends K ? never : symbol extends K ? never : K]: T[K];
};

/**
 * Maps a single method from a `ServiceDefinition` to the matching
 * {@link ResolvedHandler} call type (`unary`, `serverStream`, etc.).
 */
type InferCallType<TDef> = TDef extends MethodDefinition<infer Req, infer Res>
	? TDef extends { requestStream: false; responseStream: false }
		? ResolvedHandler<Req, Res, "unary">
		: TDef extends { requestStream: false; responseStream: true }
			? ResolvedHandler<Req, Res, "serverStream">
			: TDef extends { requestStream: true; responseStream: false }
				? ResolvedHandler<Req, Res, "clientStream">
				: TDef extends { requestStream: true; responseStream: true }
					? ResolvedHandler<Req, Res, "bidiStream">
					: ResolvedHandler<Req, Res>
	: never;

/**
 * A type-safe map from RPC method names to their corresponding
 * {@link ResolvedHandler} instances, inferred from a generated `ServiceDefinition`.
 */
type ServiceHandlerMap<TDef> = {
	[K in LiteralKeys<TDef>]: InferCallType<TDef[K]>;
};

/**
 * Validate a handler map against a generated gRPC `ServiceDefinition`.
 *
 * Every RPC method must be present, and each handler must match the correct
 * request/response types and streaming kind. Missing methods, wrong message
 * types, or mismatched streaming kinds are compile-time errors.
 *
 * @example
 * ```ts
 * const greeterService = createService<typeof GreeterService>({
 *   sayHello: handler()
 *     .request(HelloRequest)
 *     .reply(HelloReply)
 *     .unary(async ({ req, ctx }) => {
 *       const reply = new HelloReply();
 *       reply.setMessage(`Hello, ${req.getName()}!`);
 *       return reply;
 *     }),
 * });
 * ```
 */
const createService = <TDef extends ServiceDefinition>(handlers: ServiceHandlerMap<TDef>): ServiceHandlerMap<TDef> => {
	return handlers;
};

export type { ServiceHandlerMap };
export { createService };
