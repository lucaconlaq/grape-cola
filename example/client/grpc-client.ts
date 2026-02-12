import * as grpc from "@grpc/grpc-js";
import { GreeterClient } from "./gen/greeter_grpc_pb.js";

const target = process.env.GREETER_ADDR ?? "localhost:50051";
const client = new GreeterClient(target, grpc.credentials.createInsecure());

export { client, target };
