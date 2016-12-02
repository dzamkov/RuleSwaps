
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

// A format for a boolean value.
Format.Bool = function() { };
Format.Bool.prototype = Object.create(Format.prototype);

Format.Bool.prototype.encode = function(value) {
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
	return card ? card.name : null;
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
	return cards ? cards.counts : null;
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
	if (exp === null) return null;
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
	if (value === null) return null;
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
	return this.formatId.encode(value.id);
};

Format.Id.prototype.decode = function(source) {
	let id = this.formatId.decode(source);
	let res = this.byId[id];
	if (!res) throw Format.Exception;
	return res;
};

Format.id = function(formatId, byId) {
	return new Format.Id(byId);
};

// A format for a game setup
Format.setup = Format.record({
	players: Format.list(Format.record({
		name: Format.any,
		userId: Format.any,
		coins: Format.nat,
		hand: Format.cardSet.orNull()
	})),
	constitution: Format.list(Format.exp),
	deck: Format.cardSet.orNull()
});