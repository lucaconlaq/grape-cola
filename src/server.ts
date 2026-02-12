import * as grpc from "@grpc/grpc-js";
import type { Handler } from "./handler.js";
import type { ServiceHandlerMap } from "./service.js";
import { resolveContext } from "./testing.js";
import type { AfterFn, GrpcCall, InjectFn, MiddlewareFn, MiddlewareWithAfterFn, ResolvedHandler } from "./types.js";

/** Options for constructing a {@link GrapeColaServer} directly. */
interface ServerOptions<TContext = any> {
	/** Functions that extract values from the raw gRPC call and merge them into the base context. */
	injectInContext: InjectFn[];
	/** Middleware that runs on every handler before per-handler middleware. */
	defaultMiddleware?: (MiddlewareFn | MiddlewareWithAfterFn)[];
	/** Called after the server binds (or fails to bind). Receives the resolved context, the bound port, or an error. */
	onStart?: (opts: { ctx: TContext; port?: number; error?: Error }) => void | Promise<void>;
}

/**
 * A gRPC server that applies context injection and middleware to every handler.
 *
 * Prefer {@link createServer} for the common case — it reads inject functions
 * and middleware from a {@link Handler}.
 */
class GrapeColaServer {
	private _server: grpc.Server;
	private _injectInContext: InjectFn[];
	private _defaultMiddleware: (MiddlewareFn | MiddlewareWithAfterFn)[];
	private _onStart?: ServerOptions["onStart"];

	constructor(options: ServerOptions) {
		this._server = new grpc.Server();
		this._injectInContext = options.injectInContext;
		this._defaultMiddleware = options.defaultMiddleware ?? [];
		this._onStart = options.onStart;
	}

	/**
	 * Register a gRPC service on this server.
	 *
	 * @param definition - The generated `ServiceDefinition` from `@grpc/grpc-js`.
	 * @param implementation - A map of {@link ResolvedHandler} instances, typically created with {@link createService}.
	 */
	addService(definition: grpc.ServiceDefinition, implementation: ServiceHandlerMap<any>): void {
		const impl: grpc.UntypedServiceImplementation = {};

		for (const [name, resolved] of Object.entries(implementation)) {
			const handler = resolved as ResolvedHandler;

			switch (handler.__type) {
				case "unary":
					impl[name] = this._wrapUnary(handler);
					break;
				case "serverStream":
					impl[name] = this._wrapServerStream(handler);
					break;
				case "clientStream":
					impl[name] = this._wrapClientStream(handler);
					break;
				case "bidiStream":
					impl[name] = this._wrapBidiStream(handler);
					break;
			}
		}

		if (Object.keys(definition).length > 0) {
			this._server.addService(definition, impl);
		}
	}

	/**
	 * Bind to the given host and port and start serving.
	 *
	 * @returns The actual port the server bound to.
	 */
	listen(host: string, port: number): Promise<number> {
		return new Promise((resolve, reject) => {
			this._server.bindAsync(`${host}:${port}`, grpc.ServerCredentials.createInsecure(), async (err, boundPort) => {
				if (err) {
					if (this._onStart) {
						const ctx = await this._buildStartContext();
						await this._onStart({ ctx, error: err });
					}
					reject(err);
				} else {
					if (this._onStart) {
						const ctx = await this._buildStartContext();
						await this._onStart({ ctx, port: boundPort });
					}
					resolve(boundPort);
				}
			});
		});
	}

	private _buildBaseContext(call?: GrpcCall): any {
		let base: any = {};
		for (const inject of this._injectInContext) {
			base = { ...base, ...inject(call) };
		}
		return base;
	}

	private async _buildStartContext(): Promise<any> {
		const base = this._buildBaseContext();
		const { ctx } = await resolveContext(base, ...this._defaultMiddleware);
		return ctx;
	}

	private async _runMiddlewares(handler: ResolvedHandler, call: GrpcCall): Promise<{ ctx: any; afters: AfterFn[] }> {
		return resolveContext(this._buildBaseContext(call), ...handler.middlewares);
	}

	private async _runAfters(afters: AfterFn[]): Promise<void> {
		for (let i = afters.length - 1; i >= 0; i--) {
			await afters[i]();
		}
	}

	private _wrapUnary(handler: ResolvedHandler): grpc.handleUnaryCall<any, any> {
		return async (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
			try {
				const { ctx, afters } = await this._runMiddlewares(handler, call);
				const response = await handler.fn({ req: call.request, ctx, call });
				await this._runAfters(afters);
				callback(null, response);
			} catch (err) {
				this._sendError(callback, err);
			}
		};
	}

	private _wrapServerStream(handler: ResolvedHandler): grpc.handleServerStreamingCall<any, any> {
		return async (call: grpc.ServerWritableStream<any, any>) => {
			try {
				const { ctx, afters } = await this._runMiddlewares(handler, call);
				await handler.fn({ req: call.request, ctx, call });
				await this._runAfters(afters);
				call.end();
			} catch (err) {
				call.destroy(this._toGrpcError(err));
			}
		};
	}

	private _wrapClientStream(handler: ResolvedHandler): grpc.handleClientStreamingCall<any, any> {
		return async (call: grpc.ServerReadableStream<any, any>, callback: grpc.sendUnaryData<any>) => {
			try {
				const { ctx, afters } = await this._runMiddlewares(handler, call);
				const response = await handler.fn({ ctx, call });
				await this._runAfters(afters);
				callback(null, response);
			} catch (err) {
				this._sendError(callback, err);
			}
		};
	}

	private _wrapBidiStream(handler: ResolvedHandler): grpc.handleBidiStreamingCall<any, any> {
		return async (call: grpc.ServerDuplexStream<any, any>) => {
			try {
				const { ctx, afters } = await this._runMiddlewares(handler, call);
				await handler.fn({ ctx, call });
				await this._runAfters(afters);
				call.end();
			} catch (err) {
				call.destroy(this._toGrpcError(err));
			}
		};
	}

	private _sendError(callback: grpc.sendUnaryData<any>, err: unknown): void {
		if (err instanceof Error && "code" in err) {
			callback(err as grpc.ServiceError);
		} else {
			const grpcError: Partial<grpc.ServiceError> = {
				code: grpc.status.INTERNAL,
				message: err instanceof Error ? err.message : "Internal server error",
			};
			callback(grpcError as grpc.ServiceError);
		}
	}

	private _toGrpcError(err: unknown): Error {
		if (err instanceof Error && "code" in err) {
			return err;
		}
		const grpcError = new Error(err instanceof Error ? err.message : "Internal server error") as Error & {
			code: number;
		};
		grpcError.code = grpc.status.INTERNAL;
		return grpcError;
	}
}

/**
 * Create a {@link GrapeColaServer} from a {@link Handler}.
 *
 * This is the recommended way to create a server — it pulls `injectInContext`
 * and `defaultMiddleware` from the handler so the server and handlers always
 * share the same context shape.
 *
 * @example
 * ```ts
 * const server = createServer({
 *   handler,
 *   onStart: ({ ctx, port }) => ctx.logger.info(`listening on :${port}`),
 * });
 *
 * server.addService(GreeterService, greeterHandlers);
 * await server.listen("0.0.0.0", 50051);
 * ```
 */
const createServer = <TContext>(options: {
	/** The handler whose inject functions and default middleware the server will use. */
	handler: Handler<TContext>;
	/** Called after the server binds (or fails to bind). */
	onStart?: (opts: { ctx: TContext; port?: number; error?: Error }) => void | Promise<void>;
}): GrapeColaServer => {
	return new GrapeColaServer({
		injectInContext: options.handler.injectInContext,
		defaultMiddleware: options.handler.defaultMiddleware,
		onStart: options.onStart as ServerOptions["onStart"],
	});
};

export type { ServerOptions };
export { GrapeColaServer, createServer };
