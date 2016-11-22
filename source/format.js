
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