
// Contains functions for encoding, decoding and validating values of a given type. Can also be used for
// picking a simple representative of that type.
function Format(simple) {
	this.simple = simple;
}

// Encodes a value of the format type as a simple JSON-able object.
Format.prototype.encode = function(value) { 
	// TODO
}

// Decodes an object of the format type from a JSON object. Throws an exception if the object is malformed.
Format.prototype.decode = function(source) {
	// TODO
}

// The exception thrown when a decode fails.
Format.Exception = { };
Format.Exception.name = "Format exception";
Format.Exception.toString = function() { return this.name };

// A format which assumes nothing about its contained value and does no encoding or decoding.
Format.any = new Format(null);
Format.any.encode = function(value) { return value; }
Format.any.decode = function(value) { return value; }

// A format for a boolean value.
Format.bool = new Format(false);

Format.bool.encode = function(value) {
	return value;
}

Format.bool.decode = function(value) {
	if (typeof value !== "boolean") throw Format.Exception;
	return value;
}


// A format for a card, or null.
Format.card = new Format(null);

Format.card.encode = function(card) {
	return card.name;
}

Format.card.decode = function(source) {
	if (source === null) return null;
	if (typeof source !== "string") throw Format.Exception;
	let res = Card.get(source);
	if (!res) throw Format.Exception;
	return res;
}

// A format for a card set.
Format.cardSet = function(allowNull, totalCount) {
	return new Format.CardSet(allowNull || false, totalCount || null);
};

Format.CardSet = function(allowNull, totalCount) {
	this.allowNull = allowNull;
	this.totalCount = totalCount;
};

Format.CardSet.prototype = Object.create(Format.prototype);

Format.CardSet.prototype.encode = function(cards) {
	return cards ? cards.counts : null;
}

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
	if (this.totalCount && totalCount !== this.totalCount) throw Format.Exception;
	return new CardSet(counts, totalCount);
}

// A format for an expression, or null.
Format.exp = new Format(null);

Format.exp.encode = function(exp) {
	if (exp === null) return null;
	let list = exp.toList();
	let nList = new Array(list.length);
	for (let i = 0; i < list.length; i++) nList[i] = Format.card.encode(list[i]);
	return nList;
}

Format.exp.decode = function(source) {
	if (source === null) return null;
	if (!(source instanceof Array)) throw Format.Exception;
	let res = Expression.fromList(source);
	if (!res) throw Format.Exception;
	return res;
}


// A format for a non-negative integer less than the given value.
Format.num = function(limit) {
	let format = Format.num[limit];
	if (format) return format;
	else return Format.num[limit] = new Format.Num(limit);
}

Format.Num = function(limit) {
	Format.call(this, 0);
	this.limit = limit;
}

Format.Num.prototype = Object.create(Format.prototype);

Format.Num.prototype.encode = function(value) {
	return value;
}

Format.Num.prototype.decode = function(value) {
	if (typeof value !== "number") throw Format.Exception;
	let num = Math.floor(value);
	if (num !== value) throw Format.Exception;
	if (!(num >= 0 && num < this.limit)) throw Format.Exception;
	return num;
}

// A format for any natural number.
Format.nat = Format.num(Infinity);


// A format for a list of non-null things.
Format.list = function(inner) {
	return new Format.List(inner);
}

Format.List = function(inner) {
	Format.call(this, []);
	this.inner = inner;
}

Format.List.prototype = Object.create(Format.prototype);

Format.List.prototype.encode = function(list) {
	let nList = new Array(list.length);
	for (let i = 0; i < list.length; i++) {
		let item = nList[i] = this.inner.encode(list[i]);
		console.assert(item !== null);
	}
	return nList;
}

Format.List.prototype.decode = function(source) {
	if (!(source instanceof Array)) throw Format.Exception;
	let nList = new Array(source.length);
	for (let i = 0; i < source.length; i++) {
		let item = nList[i] = this.inner.decode(source[i]);
		if (item === null) throw Format.Exception;
	}
	return nList;
}

Format.cardList = Format.list(Format.card);

// A format for a custom object, or null.
Format.obj = function(props) {
	return new Format.Obj(props);
}

Format.Obj = function(props) {
	Format.call(this, null);
	this.props = props;
}

Format.Obj.prototype.encode = function(value) {
	if (value === null) return null;
	let obj = { };
	for (let prop in this.props) {
		obj[prop] = this.props[prop].encode(value[prop]);
	}
	return obj;
}

Format.Obj.prototype.decode = function(source) {
	if (source === null) return null;
	if (typeof source !== "object") throw Format.Exception;
	let obj = { };
	for (let prop in source) {
		let format = this.props[prop];
		if (!format) throw Format.Exception;
		obj[prop] = format.decode(source[prop]);
	}
	for (let prop in this.props) {
		if (!obj.hasOwnProperty(prop)) throw Format.Exception;
	}
	return obj;
}

// A format for a game setup
Format.setup = Format.obj({
	players: Format.list(Format.obj({
		name: Format.any,
		userId: Format.any,
		coins: Format.nat,
		hand: Format.cardSet()
	})),
	constitution: Format.list(Format.exp),
	deck: Format.cardSet()
});