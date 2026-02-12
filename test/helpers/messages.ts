// --- Simple fake message classes (handler tests) ---

export class FakeRequest {
	constructor(public value = "") {}
}

export class FakeReply {
	constructor(public value = "") {}
}

// --- Fake message classes (todo domain, service tests) ---

export class TaskRequest {
	private _id = "";
	getId() {
		return this._id;
	}
	setId(v: string) {
		this._id = v;
	}
}

export class TaskReply {
	private _title = "";
	getTitle() {
		return this._title;
	}
	setTitle(v: string) {
		this._title = v;
	}
}

// --- Plain-object message classes (e2e server tests) ---

export class EchoRequest {
	constructor(public id = "") {}
}

export class EchoReply {
	constructor(public title = "") {}
}
