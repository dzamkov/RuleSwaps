
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

// Constructs a restricted form of this format that expects collection-like objects to have a certain size.
Format.prototype.withSize = function(size) {
	return this;
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
	if (this.allowNull && source === null) return null;
	if (typeof source !== "string") throw Format.Exception;
	let res = Card.get(source);
	if (!res) throw Format.Exception;
	return res;
};

Format.Card.prototype.orNull = function() {
	return new Format.Card(true);
};

Format.card = new Format.Card(false);


// A format for a card set.
Format.CardSet = function(allowNull, size) {
	this.allowNull = allowNull;
	this.size = size;
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
	if (source === null && this.allowNull) return null;
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

Format.CardSet.prototype.orNull = function() {
	return new Format.CardSet(true, this.totalCount);
};

Format.CardSet.prototype.withSize = function(size) {
	return new Format.CardSet(this.allowNull, size);
};

Format.cardSet = new Format.CardSet(false, null);


// A format for an expression, or null.
Format.Exp = function(allowNull) {
	this.allowNull = allowNull;
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
	if (source === null && this.allowNull) return null;
	if (!(source instanceof Array)) throw Format.Exception;
	let res = Expression.fromList(source);
	if (!res) throw Format.Exception;
	return res;
};

Format.Exp.prototype.orNull = function() {
	return new Format.Exp(true);
};

Format.exp = new Format.Exp(false);


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
	if (source === null && this.allowNull) return null;
	if (!(source instanceof Array)) throw Format.Exception;
	let nList = new Array(source.length);
	for (let i = 0; i < source.length; i++) {
		let item = nList[i] = this.inner.decode(source[i]);
		if (item === null) throw Format.Exception;
	}
	return nList;
};

Format.List.prototype.orNull = function() {
	return new Format.List(this.inner, true);
}

Format.list = function(inner) {
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
	if (source === null && this.allowNull) return null;
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

Format.Record.prototype.orNull = function() {
	return new Format.Record(this.props, true);
};

Format.record = function(props) {
	return new Format.Record(props, false);
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

Format.id = function(formatId, byId) {
	return new Format.Id(formatId, byId);
};

// A format for a game setup.
Format.gameSetup = Format.record({
	constitution: Format.list(Format.exp),
	deck: Format.cardSet
});

// Provides the public display information for a player.
Format.playerInfo = Format.record({
	
	// The name of the player.
	name: Format.str
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
	
	// Network messages related to the game. Session Id is assumed.
	game: {
		
		// The initial request for game information.
		introRequest: Format.nil,
		
		// A response to the initial request for game information.
		introResponse: Format.record({
			
			// The setup configuration for the game.
			setup: Format.gameSetup,
			
			// The players for this game, in order.
			players: Format.list(Format.playerInfo),
			
			// Your index in the players list for the game, or null if you
			// are an observer.
			youId: Format.nat.orNull(),
			
			// Provides the data already generated in the game. If the game has already been completed, this
			// will be the full set of game data, enough to reconstruct the entire game.
			data: Format.gamePollResponse
		}),
		
		// A request for additional game information.
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
			
			// The Id of the commitment to resolve.
			id: Format.nat,
			
			// The value that was provided for the commitment.
			value: Format.any
			
		}),
		
		// A request to send a chat message. This message gets no response.
		chat: Format.str
	}
};