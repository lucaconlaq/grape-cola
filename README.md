# Grape Cola

<p align="center">
  <img src="./.github/logo.png" alt="Grape Cola" width="200" />
</p>

[![npm](https://img.shields.io/npm/v/@lucaconlaq/grape-cola)](https://www.npmjs.com/package/@lucaconlaq/grape-cola)
[![biome](https://img.shields.io/badge/code_style-biome-56BEB8)](https://biomejs.dev)
[![vitest](https://img.shields.io/badge/tested_with-vitest-6E9FEC)](https://vitest.dev)

**What it is** — a thin wrapper that gives `grpc-js` a better DX.

**What it isn't** — a new protocol. Any gRPC client connects as usual.

## Quick start

### 1. Create a handler

A handler is a factory that carries shared context and middleware. Every RPC you define goes through it.

```ts
import {
  createHandler,
  GrpcCall,
  injectGRPCLoggingContext,
  withClock,
  withGRPCLogging,
  withLogger,
} from "@lucaconlaq/grape-cola";

// inject functions extract values from the raw gRPC call into context
const injectAuthContext = (call?: GrpcCall) => ({
  authorization: call?.metadata.get("authorization")[0]?.toString(),
});

const handler = createHandler({
  injectInContext: [injectGRPCLoggingContext, injectAuthContext],
  defaultMiddleware: [withLogger(), withClock(), withGRPCLogging()],
});
```

### 2. Define RPCs

Use the builder chain to set request/reply types and pick the RPC kind:

```ts
const sayHello = handler()
  .request(HelloRequest)
  .reply(HelloReply)
  .unary(async ({ req }) => {
    const reply = new HelloReply();
    reply.setMessage(`hello, ${req.getName()}!`);
    return reply;
  });

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
```

All four gRPC patterns are supported: `.unary()`, `.serverStream()`, `.clientStream()`, `.bidiStream()`.

### 3. Group RPCs into services

`createService` validates your handler map against the generated `ServiceDefinition` at compile time — missing methods, wrong message types, or mismatched streaming kinds are type errors.

Given a proto file like:

```proto
service Greeter {
  rpc SayHello (HelloRequest) returns (HelloReply);
  rpc SayHelloReversed (HelloRequest) returns (HelloReply);
  rpc StreamHello (HelloRequest) returns (stream HelloReply);
  rpc CollectHellos (stream HelloRequest) returns (HelloReply);
  rpc ChatHello (stream HelloRequest) returns (stream HelloReply);
}
```

You wire up all the handlers:

```ts
import { createService } from "@lucaconlaq/grape-cola";
import { GreeterService } from "./gen/greeter_grpc_pb";

const greeterService = createService<typeof GreeterService>({
  sayHello,
  sayHelloReversed,
  streamHello,
  collectHellos,
  chatHello,
});
```

### 4. Start the server

```ts
import { createServer } from "@lucaconlaq/grape-cola";

const server = createServer({
  handler,
  onStart: ({ ctx, error }) => {
    if (error) throw error;
    ctx.logger.info("🚀 listening on 0.0.0.0:50051");
  },
});

server.addService(GreeterService, greeterService);
server.addService(AuthService, authService);
await server.listen("0.0.0.0", 50051);
```

---

## 🔌 Context & middleware

Grape Cola builds a typed context that flows through every request. The context is assembled in two layers:

### Inject functions

`injectInContext` functions run first. They receive the raw gRPC call and extract values (metadata headers, path, etc.) into the base context:

```ts
const injectAuthContext = (call?: GrpcCall) => {
  const authorization = call?.metadata.get("authorization")[0]?.toString();
  return { authorization };
};
```

### Middleware

Default middleware runs next, sequentially. Each middleware receives the accumulated context and returns new fields to merge into it. TypeScript tracks the context shape at every step — if a middleware requires `{ logger: Logger }`, the compiler ensures a previous middleware provides it.

```ts
import { middleware } from "@lucaconlaq/grape-cola";

const withLogger = () =>
  middleware<{ logger?: Logger }>()<{ logger: Logger }>(async ({ ctx }) => ({
    logger: ctx.logger ?? pino(),
  }));
```

### Per-handler middleware

Individual RPCs can add extra middleware with `.use()`. This is useful for capabilities only some endpoints need (e.g. auth, database):

```ts
const login = handler()
  .use(withDb())                    // adds { db } to context
  .request(LoginRequest)
  .reply(LoginReply)
  .unary(async ({ req, ctx }) => {
    const user = ctx.db.findUser(req.getUsername());
    // ...
  });

const saySecretGreeting = handler()
  .use(withDb())                    // adds { db }
  .use(withAuth())                  // adds { user } — requires { db, authorization }
  .request(SecretRequest)
  .reply(SecretReply)
  .unary(async ({ req, ctx }) => {
    // ctx.user is fully typed here
  });
```

### After functions ♻️

`middlewareWithAfter` lets a middleware return a function that runs _after_ the handler completes, in reverse middleware order. Perfect for logging, tracing, or resource cleanup:

```ts
import { middlewareWithAfter, withAfter } from "@lucaconlaq/grape-cola";

const withLogging = () =>
  middlewareWithAfter<{ clock: Clock; logger: Logger }>()(async ({ ctx }) => {
    const startedAt = ctx.clock.now();
    return withAfter({}, () => {
      const duration = ctx.clock.now() - startedAt;
      ctx.logger.info(`completed in ${duration}ms`);
    });
  });
```

---

## 🧩 Built-in middleware

| Middleware | Adds to context | Peer deps |
|---|---|---|
| `withClock()` | `clock` — injectable `sleep` + `now` abstraction. Use `immediateClock` in tests. | — |
| `withLogger()` | `logger` — pino logger instance | `pino`, `pino-pretty` |
| `withGRPCLogging()` | logs request duration and path | `pino` |

All three preserve existing context values, so tests can inject fakes. They compose together like this:

```ts
import {
  createHandler,
  injectGRPCLoggingContext,
  withClock,
  withGRPCLogging,
  withLogger,
} from "@lucaconlaq/grape-cola";

const handler = createHandler({
  injectInContext: [injectGRPCLoggingContext],
  defaultMiddleware: [withLogger(), withClock(), withGRPCLogging()],
});
```

---

## 🧪 Testing

Grape Cola ships two utilities that let you run handlers and middleware **without starting a gRPC server**.

### `testHandler`

Runs a resolved handler in isolation. Pass a `baseCtx` to satisfy middleware requirements, and a `req` (or `streamInput` for streaming RPCs):

```ts
import { testHandler } from "@lucaconlaq/grape-cola";

// unary
const { reply } = await testHandler(greeterService.sayHello, {
  baseCtx: createBaseCtx(),
  req: makeHelloRequest("world"),
});
expect(reply.getMessage()).toBe("hello, world!");

// server stream
const { output } = await testHandler(greeterService.streamHello, {
  baseCtx: createBaseCtx(),
  req: makeHelloRequest("world"),
});
expect(output).toHaveLength(3);
```

Since middleware reads from context, you can swap in test doubles by overriding `baseCtx`. For example, an `immediateClock` that resolves `sleep()` instantly:

```ts
const { output } = await testHandler(greeterService.streamHello, {
  baseCtx: createBaseCtx({ clock: immediateClock }),
  req: makeHelloRequest("world"),
});
// no actual waiting — the handler runs instantly
```

### `testMiddleware`

Tests a single middleware in isolation. Returns the merged `ctx` and, for `middlewareWithAfter`, the `after` cleanup function:

```ts
import { testMiddleware } from "@lucaconlaq/grape-cola";

const { ctx } = await testMiddleware(withLogger(), {
  baseCtx: {},
});
expect(ctx.logger).toBeDefined();

// with after function
const { after } = await testMiddleware(withLogging(), {
  baseCtx: createBaseCtx({ logger: spyLogger }),
});
after!();
expect(spyLogger.messages).toHaveLength(1);
```

### Typical test helper

A small helper that pre-fills the base context keeps tests concise:

```ts
const createBaseCtx = (overrides?: Record<string, unknown>) => ({
  logger: pino({ level: "silent" }),
  clock: immediateClock,
  message: "hello",
  request: { id: "test-123", path: "/TestService/testMethod" },
  ...overrides,
});
```
