import type * as grpc from "@grpc/grpc-js";
import { Box, Text, useApp, useInput } from "ink";
import Gradient from "ink-gradient";
import TextInput from "ink-text-input";
import { useRef, useState } from "react";
import { HelloRequest } from "./gen/greeter_pb.js";
import type { HelloReply } from "./gen/greeter_pb.js";
import { client, target } from "./grpc-client.js";

type RpcMethod = "sayHello" | "sayHelloReversed" | "streamHello" | "collectHellos" | "chatHello";

type Message = { text: string; gradient?: boolean; dim?: boolean };

type View =
	| { type: "menu" }
	| { type: "input"; method: Exclude<RpcMethod, "collectHellos" | "chatHello"> }
	| { type: "collect"; names: string[] }
	| { type: "running"; method: RpcMethod; messages: Message[]; done: boolean }
	| { type: "chatting"; messages: Message[] };

const methods: { label: string; value: RpcMethod; badge: string }[] = [
	{ label: "Say Hello", value: "sayHello", badge: "unary" },
	{ label: "Say Hello Reversed", value: "sayHelloReversed", badge: "unary" },
	{ label: "Stream Hello", value: "streamHello", badge: "server stream" },
	{ label: "Collect Hellos", value: "collectHellos", badge: "client stream" },
	{ label: "Chat Hello", value: "chatHello", badge: "bidi stream" },
];

const methodLabel = (m: RpcMethod) => methods.find((x) => x.value === m)?.label;

// ── Select ──────────────────────────────────────────────────────

function Select({
	onSelect,
}: {
	onSelect: (value: RpcMethod | "exit") => void;
}) {
	const [cursor, setCursor] = useState(0);
	const total = methods.length + 1;

	useInput((_input, key) => {
		if (key.upArrow) setCursor((c) => (c > 0 ? c - 1 : total - 1));
		else if (key.downArrow) setCursor((c) => (c < total - 1 ? c + 1 : 0));
		else if (key.return) {
			onSelect(cursor < methods.length ? methods[cursor]?.value : "exit");
		}
	});

	return (
		<Box flexDirection="column">
			{methods.map((m, i) => (
				<Box key={m.value} gap={1}>
					<Text color={cursor === i ? "green" : undefined}>{cursor === i ? "❯" : " "}</Text>
					<Text bold={cursor === i}>{m.label}</Text>
					<Text dimColor>({m.badge})</Text>
				</Box>
			))}
			<Text> </Text>
			<Box gap={1}>
				<Text color={cursor === methods.length ? "red" : undefined}>{cursor === methods.length ? "❯" : " "}</Text>
				<Text bold={cursor === methods.length} color={cursor === methods.length ? "red" : "gray"}>
					Exit
				</Text>
			</Box>
		</Box>
	);
}

// ── App ─────────────────────────────────────────────────────────

function App() {
	const { exit } = useApp();
	const [view, setView] = useState<View>({ type: "menu" });
	const [input, setInput] = useState("");
	const chatStream = useRef<ReturnType<typeof client.chatHello> | null>(null);

	const goToMenu = () => {
		setView({ type: "menu" });
		setInput("");
	};

	useInput((_input, key) => {
		if (key.escape && view.type !== "menu") {
			if (chatStream.current) {
				chatStream.current.end();
				chatStream.current = null;
			}
			goToMenu();
		}
		if (key.return && view.type === "running" && view.done) {
			goToMenu();
		}
	});

	// ── menu ────────────────────────────────────────────────────

	const handleMenuSelect = (value: RpcMethod | "exit") => {
		if (value === "exit") {
			exit();
			return;
		}
		setInput("");
		if (value === "collectHellos") setView({ type: "collect", names: [] });
		else if (value === "chatHello") startChat();
		else setView({ type: "input", method: value });
	};

	// ── unary / server-stream input ─────────────────────────────

	const handleInputSubmit = (value: string) => {
		const name = value.trim();
		if (!name || view.type !== "input") return;
		setInput("");
		const method = view.method;
		setView({ type: "running", method, messages: [], done: false });

		if (method === "sayHello" || method === "sayHelloReversed") {
			const req = new HelloRequest();
			req.setName(name);
			const cb = (err: grpc.ServiceError | null, res: HelloReply) => {
				setView((v) =>
					v.type === "running"
						? {
								...v,
								messages: [
									...v.messages,
									err
										? { text: `Error: ${err.message}` }
										: {
												text: res.getMessage(),
												gradient: method === "sayHelloReversed",
											},
								],
								done: true,
							}
						: v,
				);
			};
			if (method === "sayHello") client.sayHello(req, cb);
			else client.sayHelloReversed(req, cb);
		} else {
			const req = new HelloRequest();
			req.setName(name);
			const stream = client.streamHello(req);
			stream.on("data", (res: HelloReply) => {
				setView((v) => (v.type === "running" ? { ...v, messages: [...v.messages, { text: res.getMessage() }] } : v));
			});
			stream.on("end", () => {
				setView((v) => (v.type === "running" ? { ...v, done: true } : v));
			});
			stream.on("error", (err: Error) => {
				setView((v) =>
					v.type === "running"
						? {
								...v,
								messages: [...v.messages, { text: `Error: ${err.message}` }],
								done: true,
							}
						: v,
				);
			});
		}
	};

	// ── collect (client stream) ─────────────────────────────────

	const handleCollectSubmit = (value: string) => {
		const name = value.trim();
		if (view.type !== "collect") return;
		setInput("");

		if (!name) {
			if (view.names.length === 0) return;
			const names = view.names;
			setView({
				type: "running",
				method: "collectHellos",
				messages: [],
				done: false,
			});
			const stream = client.collectHellos((err: grpc.ServiceError | null, res: HelloReply) => {
				setView((v) =>
					v.type === "running"
						? {
								...v,
								messages: [...v.messages, err ? { text: `Error: ${err.message}` } : { text: res.getMessage() }],
								done: true,
							}
						: v,
				);
			});
			for (const n of names) {
				const req = new HelloRequest();
				req.setName(n);
				stream.write(req);
			}
			stream.end();
			return;
		}

		setView({ ...view, names: [...view.names, name] });
	};

	// ── chat (bidi stream) ──────────────────────────────────────

	const startChat = () => {
		const stream = client.chatHello();
		chatStream.current = stream;
		setView({ type: "chatting", messages: [] });

		stream.on("data", (res: HelloReply) => {
			setView((v) =>
				v.type === "chatting"
					? {
							...v,
							messages: [...v.messages, { text: `  ← ${res.getMessage()}` }],
						}
					: v,
			);
		});
		stream.on("error", (err: Error) => {
			setView((v) =>
				v.type === "chatting"
					? {
							...v,
							messages: [...v.messages, { text: `Error: ${err.message}` }],
						}
					: v,
			);
			chatStream.current = null;
		});
		stream.on("end", () => {
			chatStream.current = null;
		});
	};

	const handleChatSubmit = (value: string) => {
		const name = value.trim();
		setInput("");
		if (!name) {
			chatStream.current?.end();
			chatStream.current = null;
			goToMenu();
			return;
		}
		if (chatStream.current) {
			const req = new HelloRequest();
			req.setName(name);
			setView((v) =>
				v.type === "chatting"
					? {
							...v,
							messages: [...v.messages, { text: `  → ${name}`, dim: true }],
						}
					: v,
			);
			chatStream.current.write(req);
		}
	};

	// ── subtitle ────────────────────────────────────────────────

	const subtitle =
		view.type === "menu"
			? `connected to ${target}`
			: view.type === "running"
				? methodLabel(view.method)
				: view.type === "collect"
					? "Collect Hellos"
					: view.type === "chatting"
						? "Chat Hello · bidi stream"
						: methodLabel(view.method);

	// ── render ──────────────────────────────────────────────────

	return (
		<Box flexDirection="column" padding={1}>
			{/* header */}
			<Box flexDirection="column" marginBottom={1}>
				<Gradient name="rainbow">⬡ greeter client</Gradient>
				<Text dimColor>{subtitle}</Text>
			</Box>

			{/* menu */}
			{view.type === "menu" && (
				<>
					<Box marginBottom={1}>
						<Text bold>Select an RPC method:</Text>
					</Box>
					<Select onSelect={handleMenuSelect} />
				</>
			)}

			{/* single-name input */}
			{view.type === "input" && (
				<>
					<Text>Enter a name:</Text>
					<Box>
						<Text bold color="green">
							{"› "}
						</Text>
						<TextInput value={input} onChange={setInput} onSubmit={handleInputSubmit} />
					</Box>
					<Box marginTop={1}>
						<Text dimColor>esc to go back</Text>
					</Box>
				</>
			)}

			{/* collect names */}
			{view.type === "collect" && (
				<>
					{view.names.length > 0 && (
						<Box marginBottom={1}>
							<Text>
								Names: <Text color="cyan">{view.names.join(", ")}</Text>
							</Text>
						</Box>
					)}
					<Text>
						{view.names.length > 0 ? `Add another name (enter empty to send ${view.names.length}):` : "Add a name:"}
					</Text>
					<Box>
						<Text bold color="green">
							{"› "}
						</Text>
						<TextInput value={input} onChange={setInput} onSubmit={handleCollectSubmit} />
					</Box>
					<Box marginTop={1}>
						<Text dimColor>esc to go back</Text>
					</Box>
				</>
			)}

			{/* result */}
			{view.type === "running" && (
				<>
					{!view.done && <Text color="yellow">⏳ Waiting for response…</Text>}
					{view.messages.map((msg, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: append-only list
						<Box key={i} gap={1}>
							<Text color="green">✓</Text>
							<Text>{msg.gradient ? <Gradient name="rainbow">{msg.text}</Gradient> : msg.text}</Text>
						</Box>
					))}
					{view.done && (
						<Box marginTop={1}>
							<Text dimColor>press enter to continue</Text>
						</Box>
					)}
				</>
			)}

			{/* chat */}
			{view.type === "chatting" && (
				<>
					{view.messages.length === 0 && <Text dimColor>Send a name to start chatting.</Text>}
					{view.messages.map((msg, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: append-only list
						<Text key={i} dimColor={msg.dim}>
							{msg.text}
						</Text>
					))}
					<Box marginTop={view.messages.length > 0 ? 1 : 0}>
						<Text bold color="cyan">
							{"› "}
						</Text>
						<TextInput value={input} onChange={setInput} onSubmit={handleChatSubmit} />
					</Box>
					<Box marginTop={1}>
						<Text dimColor>enter empty to end · esc to go back</Text>
					</Box>
				</>
			)}
		</Box>
	);
}

export { App };
