
// Contains functions for encoding, decoding and validating values of a given type. Can also be used for
// picking a simple representative of that type.
function Format() {
	
};

// Encodes a value of the format type as a simple JSON-able object.
Format.prototype.encode = function(value) { 
	// Override me
};

// Decodes an object of the format type from a JSON object. Throws an exception if the object is malformed.
Format.prototype.decode = function(source) {
	// Override me
};

// Possibly returned from a call to Format.tryRandom
Format.Retry = { };

// Randomly chooses a decoded representative of this format.
Format.prototype.random = function() {
	let res;
	while ((res = this.tryRandom()) === Format.Retry) { }
	return res;
};

// Tries randomly choosing a decoded representative of this format, possibly returning Format.Retry when a
// representative could not be found in one attempt.
Format.prototype.tryRandom = function() {
	return this.random();
};

// The exception thrown when a decode fails.
Format.Exception = { };
Format.Exception.name = "Format exception";
Format.Exception.toString = function() { return this.name };

// A format which assumes nothing about its contained value and does no encoding or decoding.
Format.Any = function() { };
Format.Any.prototype = Object.create(Format.prototype);
Format.Any.prototype.encode = function(value) { return value; }
Format.Any.prototype.decode = function(value) { return value; }
Format.any = new Format.Any();

// A format which allows null or a value of the given inner format.
Format.OrNull = function(inner) { 
	this.inner = inner;
};

Format.OrNull.prototype = Object.create(Format.prototype);

Format.OrNull.prototype.encode = function(value) {
	if (value === null) return null;
	return this.inner.encode(value);
};

Format.OrNull.prototype.decode = function(value) {
	if (value === null) return null;
	return this.inner.decode(value);
};

Format.OrNull.prototype.tryRandom = function() {
	if (Math.random() < 0.1) return null;
	return this.inner.tryRandom();
};

Format.prototype.orNull = function() {
	return new Format.OrNull(this);
};

// A format for a string value.
Format.String = function() { };
Format.String.prototype = Object.create(Format.prototype);

Format.String.prototype.encode = function(value) {
	console.assert(typeof value === "string");
	return value;
};

Format.String.prototype.decode = function(value) {
	if (typeof value !== "string") throw Format.Exception;
	return value;
};

Format.String.prototype.random = function() {
	return (Math.random() + 1).toString(36).substring(2, Math.floor(2 + Math.random() * 10));
};

Format.str = new Format.String();

// A format for no data.
Format.Nil = function() { };
Format.Nil.prototype = Object.create(Format.prototype);

Format.Nil.prototype.encode = function(value) {
	console.assert(!value);
	return null;
};

Format.Nil.prototype.decode = function(source) {
	if (source !== null) throw Format.Exception;
	return null;
};

Format.Nil.prototype.random = function() {
	return null;
};

Format.nil = new Format.Nil();

// A format for a boolean value.
Format.Bool = function() { };
Format.Bool.prototype = Object.create(Format.prototype);

Format.Bool.prototype.encode = function(value) {
	console.assert(typeof value === "boolean");
	return value;
};

Format.Bool.prototype.decode = function(value) {
	if (typeof value !== "boolean") throw Format.Exception;
	return value;
};


Format.Bool.prototype.random = function() {
	return Math.random() < 0.5 ? false : true;
};

Format.bool = new Format.Bool();


// A format for a card.
Format.Card = function(allowNull) {
	this.allowNull = allowNull;
};

Format.Card.prototype = Object.create(Format.prototype);

Format.Card.prototype.encode = function(card) {
	if (card === null) {
		console.assert(this.allowNull);
		return null;
	}
	return card.name;
};

Format.Card.prototype.decode = function(source) {
	if (source === null) {
		if (this.allowNull) return null;
		throw Format.Exception;
	}

	if (typeof source !== "string") throw Format.Exception;
	let res = Card.get(source);
	if (!res) throw Format.Exception;
	return res;
};

Format.Card.prototype.orNull = function() {
	return new Format.Card(true);
};

Format.Card.prototype.random = function() {
	if (this.allowNull && Math.random() < 0.1) return null;
	return Card.list[Math.floor(Math.random() * Cards.list.length)];
};

Format.card = new Format.Card(false);


// A format for a card set.
Format.CardSet = function(allowNull, size, superset) {
	this.allowNull = allowNull;
	this.size = size;
	this.superset = superset;
};

Format.CardSet.prototype = Object.create(Format.prototype);

Format.CardSet.prototype.encode = function(cards) {
	if (cards === null) {
		console.assert(this.allowNull);
		return null;
	}
	return cards.counts;
};

Format.CardSet.prototype.decode = function(source) {
	if (source === null) {
		if (this.allowNull) return null;
		throw Format.Exception;
	}

	if (!(source instanceof Object)) throw Format.Exception;
	let counts = { };
	let totalCount = 0;
	for (let card in source) {
		if (!Card.get(card)) throw Format.Exception;
		let count = Format.nat.decode(source[card]);
		counts[card] = count;
		totalCount += count;
	}
	if (this.size && totalCount !== this.size) throw Format.Exception;
	return new CardSet(counts, totalCount);
};

Format.CardSet.prototype.tryRandom = function() {
	let superset = CardSet.create(this.superset || defaultDeck);
	let size = this.size || Format.nat.lessThan(superset.totalCount).random();
	let res = CardSet.create();
	for (let i = 0; i < size; i++) {
		let card = superset.draw();
		if (!card) return Format.Retry;
		res.insert(card);
	}
	return res;
};

Format.CardSet.prototype.withSuperset = function(superset) {
	return new Format.CardSet(this.allowNull, this.size, superset);
};

Format.CardSet.prototype.withSize = function(size) {
	return new Format.CardSet(this.allowNull, size, this.superset);
};

Format.CardSet.prototype.orNull = function() {
	return new Format.CardSet(true, this.size, this.superset);
};

Format.cardSet = new Format.CardSet(false, null, null);


// A format for an expression, or null.
Format.Exp = function(role, allowNull, superset) {
	this.role = role;
	this.allowNull = allowNull;
	this.superset = superset;
};

Format.Exp.prototype = Object.create(Format.prototype);

Format.Exp.prototype.encode = function(exp) {
	if (exp === null) {
		console.assert(this.allowNull);
		return null;
	}

	let list = exp.toList();
	let nList = new Array(list.length);
	for (let i = 0; i < list.length; i++) nList[i] = Format.card.encode(list[i]);
	return nList;
};

Format.Exp.prototype.decode = function(source) {
	// TODO: Verify superset
	if (source === null) {
		if (this.allowNull) return null;
		throw Format.Exception;
	}
	if (!(source instanceof Array)) throw Format.Exception;
	let res = Expression.fromList(source);
	if (!res) throw Format.Exception;
	return res;
};

Format.Exp.tryRandomDraw = function(role, sets) {
	let card = sets[role.id].draw();
	if (card) {
		let slots = new Array(card.slots.length);
		for (let i = 0; i < card.slots.length; i++) {
			let slot = Format.Exp.tryRandomDraw(card.slots[i], sets);
			if (!slot) return null;
			slots[i] = slot;
		}
		return new Expression(card, slots);
	}
	return null;
};

Format.Exp.prototype.tryRandom = function() {
	if (this.allowNull && Math.random() < 0.5) return null;
	
	let superset = this.superset ? this.superset : defaultDeck;
	let sets = superset.partitionByRole();
	let exp = Format.Exp.tryRandomDraw(this.role, sets);
	if (!exp) return Format.Retry;
	return exp;
};

Format.Exp.prototype.orNull = function() {
	return new Format.Exp(this.role, true, this.superset);
};

Format.Exp.prototype.withSuperset = function(superset) {
	return new Format.Exp(this.role, this.allowNull, superset);
};

Format.exp = function(role) {
	console.assert(Role[role.id] === role);
	return new Format.Exp(role, false, null);
};

// A format for a non-negative integer less than a given limit.
Format.Nat = function(limit) {
	this.limit = limit;
};

Format.Nat.prototype = Object.create(Format.prototype);

Format.Nat.prototype.encode = function(value) {
	console.assert(typeof value === "number" && value >= 0 && value < this.limit);
	return value;
};

Format.Nat.prototype.decode = function(value) {
	if (typeof value !== "number") throw Format.Exception;
	let num = Math.floor(value);
	if (num !== value) throw Format.Exception;
	if (!(num >= 0 && num < this.limit)) throw Format.Exception;
	return num;
};

Format.Nat.prototype.lessThan = function(limit) {
	return new Format.Nat(Math.min(this.limit, limit));
};

Format.Nat.prototype.random = function() {
	if (!isFinite(this.limit))
		return Math.floor(Math.exp(0.5 / Math.random()) - 1);
	else
		return Math.floor(Math.random() * this.limit);
};

Format.nat = new Format.Nat(Infinity);


// A format for a list of things.
Format.List = function(inner, allowNull) {
	this.inner = inner;
	this.allowNull = allowNull;
};

Format.List.prototype = Object.create(Format.prototype);

Format.List.prototype.encode = function(list) {
	let nList = new Array(list.length);
	for (let i = 0; i < list.length; i++) {
		let item = nList[i] = this.inner.encode(list[i]);
		console.assert(item !== null);
	}
	return nList;
};

Format.List.prototype.decode = function(source) {
	if (source === null) {
		if (this.allowNull) return null;
		throw Format.Exception;
	}
	if (!(source instanceof Array)) throw Format.Exception;
	let nList = new Array(source.length);
	for (let i = 0; i < source.length; i++) {
		let item = nList[i] = this.inner.decode(source[i]);
		if (item === null) throw Format.Exception;
	}
	return nList;
};

Format.List.prototype.tryRandom = function() {
	if (this.allowNull && Math.random() < 0.1) return null;
	let len = Format.nat.random();
	let list = [];
	for (let i = 0; i < len; i++) {
		let inner = this.inner.tryRandom();
		if (inner === Format.Retry) return Format.Retry;
		list.push(inner);
	}
	return list;
};

Format.List.prototype.orNull = function() {
	return new Format.List(this.inner, true);
};

Format.list = function(inner) {
	console.assert(inner instanceof Format);
	return new Format.List(inner, false);
};

Format.list.card = Format.list(Format.card);


// A format for a custom record.
Format.Record = function(props, allowNull) {
	this.props = props;
	this.allowNull = allowNull;
};

Format.Record.prototype = Object.create(Format.prototype);

Format.Record.prototype.encode = function(value) {
	if (value === null) {
		console.assert(this.allowNull);
		return null;
	}
	let record = { };
	for (let prop in this.props) {
		record[prop] = this.props[prop].encode(value[prop]);
	}
	return record;
};

Format.Record.prototype.decode = function(source) {
	if (source === null) {
		if (this.allowNull) return null;
		throw Format.Exception;
	}
	if (typeof source !== "object") throw Format.Exception;
	let record = { };
	for (let prop in source) {
		let format = this.props[prop];
		if (!format) throw Format.Exception;
		record[prop] = format.decode(source[prop]);
	}
	for (let prop in this.props) {
		if (!record.hasOwnProperty(prop)) throw Format.Exception;
	}
	return record;
};

Format.Record.prototype.tryRandom = function() {
	if (this.allowNull && Math.random() < 0.1) return null;
	let res = { };
	for (let prop in this.props) {
		let inner = this.props[prop].tryRandom();
		if (inner === Format.Retry) return Format.Retry;
		res[prop] = inner;
	}
	return res;
};

Format.Record.prototype.extend = function(props) {
	let nProps = {};
	Object.assign(nProps, this.props, props);
	return new Format.Record(nProps, this.allowNull);
};

Format.Record.prototype.orNull = function() {
	return new Format.Record(this.props, true);
};

Format.record = function(props) {
	return new Format.Record(props, false);
};

// A format for a dictionary object.
Format.Dict = function(key, value) {
	this.key = key;
	this.value = value;
};

Format.Dict.prototype = Object.create(Format.prototype);

Format.Dict.prototype.encode = function(source) {
	let res = { };
	for (let key in source) {
		res[this.key.encode(key)] = this.value.encode(source[key]);
	}
	return res;
};

Format.Dict.prototype.decode = function(source) {
	let res = { };
	for (let key in source) {
		res[this.key.decode(key)] = this.value.decode(source[key]);
	}
	return res;
};

Format.dict = function(key, value) {
	console.assert(key instanceof Format);
	console.assert(value instanceof Format);
	return new Format.Dict(key, value);
};

// A format for an object with an identifier.
Format.Id = function(formatId, byId) {
	this.formatId = formatId;
	this.byId = byId;
};

Format.Id.prototype = Object.create(Format.prototype);

Format.Id.prototype.encode = function(value) {
	console.assert(byId[value.id] === value);
	return this.formatId.encode(value.id);
};

Format.Id.prototype.decode = function(source) {
	let id = this.formatId.decode(source);
	let res = this.byId[id];
	if (!res) throw Format.Exception;
	return res;
};

Format.Id.prototype.random = function() {
	if (this.formatId instanceof Format.Nat && this.byId instanceof Array) {
		return this.byId[Math.floor(Math.random() * this.byId.length)];
	} else {
		let possible = [];
		for (let item in this.byId) {
			possible.push(this.byId[item]);
		}
		return possible[Math.floor(Math.random() * possible.length)];
	}
};

Format.id = function(formatId, byId) {
	return new Format.Id(formatId, byId);
};

// A format for a tagged union.
Format.Variant = function(cases) {
	this.cases = cases;
};

Format.Variant.prototype = Object.create(Format.prototype);

Format.Variant.prototype.encode = function(value) {
	let type = value.type;
	return {
		type: type,
		content: this.cases[type].encode(value.content)
	};
};

Format.Variant.prototype.decode = function(source) {
	if (!(source instanceof Object)) throw Format.Exception;
	if (Object.keys(source).length !== 2) throw Format.Exception;
	if (!source.hasOwnProperty("content")) throw Format.Exception;
	let type = source.type;
	let format = this.cases[type];
	if (!format) throw Format.Exception;
	return {
		type: type,
		content: format.decode(source.content)
	}
};

Format.variant = function(cases) {
	return new Format.Variant(cases);
};

// A format for a game setup.
Format.gameSetup = Format.record({
	constitution: Format.list(Format.exp(Role.Action)),
	deck: Format.cardSet
});

// The format for a persistent user identifier.
Format.userId = Format.str;

// The format for a persistent session token.
Format.sessionId = Format.str;

// Provides public information describing a user, excluding identifiers.
Format.userInfo = Format.record({

	// The name of the user.
	name: Format.str

});

// Provides the public information describing a player, excluding identifiers.
Format.playerInfo = Format.userInfo.extend({
	
	// The identifier for the user corresponding to this player.
	userId: Format.userId

});

// Provides the public information describing a player within a lobby.
Format.lobbyPlayerInfo = Format.record({

	// The identifier for the user corresponding to this player.
	userId: Format.userId,

	// Indicates whether this player has indicated that they are ready.
	isReady: Format.bool

});

// The format for a text message in a game.
Format.gameMessage = Format.record({
	
	// The Id of the base commitment at the time this message was made.
	baseCommitmentId: Format.nat,
	
	// The Id of the player this message originated from, or null if it is a system message.
	playerId: Format.nat.orNull(),
	
	// The content of this message.
	content: Format.str
	
});

// The format for a message in a lobby.
Format.lobbyMessage = Format.variant({

	// Indicates that there was a chat.
	chat: Format.record({

		// The Id of the user this message originated from, or null if it is a system message.
		userId: Format.userId.orNull(),

		// The text content of this message.
		text: Format.str

	}),

	// Indicates that a user has joined
	userJoin: Format.record({
		userId: Format.userId,
		userInfo: Format.userInfo,
		isPlayer: Format.bool
	}),

	// Indicates that a user has left
	userLeave: Format.record({
		userId: Format.userId,
		wasKicked: Format.bool,
		hostId: Format.userId.orNull()
	}),

	// Indicates that the player list has changed.
	shuffle: Format.list(Format.userId)

});

// The format for a poll response for a game.
Format.gamePollResponse = Format.record({
	
	// The values of selected commitments for the game
	commitments: Format.any,
	
	// The values of messages in the game
	messages: Format.list(Format.gameMessage),
	
	// The Id of the first commitment that was not accounted for in this response.
	baseCommitmentId: Format.nat,
	
	// The Id of the first message that was not accounted for in this response.
	messageId: Format.nat
});

// Provides formats for various network messages.
Format.message = {
	
	// The format for a general network message.
	general: Format.record({
		
		// The type of this message.
		type: Format.str,
		
		// The session token for the user sending this message.
		sessionId: Format.str,
		
		// The formatted content of this message.
		content: Format.any
		
	}),
	
	// Network messages related to the game.
	game: {
		
		// The initial request for game information.
		introRequest: Format.nil,
		
		// A response to the initial request for game information. When null, indicates you may not access
		// the game, or the game doesn't exist.
		introResponse: Format.record({
			
			// The configuration for the game.
			setup: Format.gameSetup,
			
			// The players for this game, in order.
			players: Format.list(Format.playerInfo),
			
			// Your index in the players list for the game, or null if you
			// are an observer.
			youId: Format.nat.orNull(),
			
			// Provides the data already generated in the game. If the game has already been completed, this
			// will be the full set of game data, enough to reconstruct the entire game.
			data: Format.gamePollResponse
			
		}).orNull(),
		
		// A request for updated game information.
		pollRequest: Format.record({
			
			// The Id of the next commitment that the client is not aware of.
			baseCommitmentId: Format.nat,
			
			// The Id of the next message that the client is not aware of.
			messageId: Format.nat
		}),
		
		// A response to a request for game information.
		pollResponse: Format.gamePollResponse,
		
		// A request to commit to a choice within a game.
		commit: Format.record({
			
			// The ID of the commitment to resolve.
			id: Format.nat,
			
			// The value that was provided for the commitment.
			value: Format.any
			
		}),
		
		// A request to send a chat message. This message gets no response.
		chat: Format.str
	},

	// Contains lobby-related messages.
	lobby: {

		// A request message.
		request: Format.variant({

			// The initial request for lobby information
			intro: Format.nil,

			// A request for updated lobby information
			poll: Format.nil,

			// A request to send a chat message
			chat: Format.str,

			// A request to shuffle players.
			shuffle: Format.list(Format.userId)

		}),

		// Various response messages, organized by request type.
		response: {

			// A response to the initial request for lobby information. When null, indicates that you                      
			// may not access the lobby.
			intro: Format.record({
			
				// The set of users (not necessarily players) in the lobby.
				users: Format.dict(Format.userId, Format.userInfo),

				// The tentative list of players for the game, in order.
				players: Format.list(Format.lobbyPlayerInfo),

				// The host for the lobby.
				hostId: Format.userId,

				// Your user ID in the lobby.
				youId: Format.userId,

				// The configuration for the game.
				setup: Format.gameSetup,
			
			}).orNull(),

			// A response to a poll request.
			poll: Format.list(Format.lobbyMessage),

			// A response to a chat message.
			chat: Format.nil,

			// A response to a shuffle message.
			shuffle: Format.nil
		}
	}
};