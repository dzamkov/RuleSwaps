// Identifies the role of card.
let Role = { };
Role[0] = Role.Action = { id: 0, str: "Action" };
Role[1] = Role.Condition = { id: 1, str: "Condition" };
Role[2] = Role.Player = { id: 2, str: "Player" };

// Identifies a type of card in the game (in general, not a specific instance).
function Card(role, text, resolve) {
	this.role = role;
	this.text = text;
	this.resolve = resolve;
	this.name = null; // Name of card in list
	
	// Parse text to determine slots
	let cur = 0;
	let start = 0;
	let state = 0;
	let parts = []
	let slots = []
	let parenthetical = null;
	function emitText() {
		if (start < cur) {
			parts.push(text.substring(start, cur));
		}
	}
	function emitSlot() {
		let str = text.substring(start, cur);
		let role = Role[str];
		if (role) {
			parts.push(role);
			slots.push(role);
		} else {
			throw "Unrecognized role ";
		}
	}
	function emitParenthetical() {
		let str = text.substring(start, cur);
		parenthetical = str;
	}
	while (cur < text.length) {
		let ch = text.charAt(cur);
		if (state === 0) {
			if (ch === '{') {
				emitText();
				start = cur + 1;
				state = 1;
			} else if (ch === '(') {
				emitText();
				start = cur + 1;
				state = 2;
			}
		} else if (state === 1) {
			if (ch === '}') {
				emitSlot();
				start = cur + 1;
				state = 0;
			}
		} else if (state === 2) {
			if (ch === ')') {
				emitParenthetical();
				start = cur + 1;
				state = 0;
				break;
			}
		}
		cur++;
	}
	if (state !== 0) {
		throw "Failed to parse text";
	}
	emitText();
	this.parts = parts;
	this.slots = slots;
	this.parenthetical = parenthetical;
}

// The list of all possible cards.
Card.list = { }

// Registers a card.
Card.register = function(name, card) {
	card.name = name;
	Card.list[name] = card;
}

// Looks up a card based on the given information.
Card.get = function(card) {
	if (typeof card === "string") card = Card.list[card];
	console.assert(card instanceof Card);
	return card;
}

// Describes an expression made up of cards.
function Expression(card, slots) {
	this.card = card;
	this.slots = slots;
}

// Gets an expression based on the given information.
Expression.get = function(exp) {
	if (exp instanceof Expression) return exp;
	return Expression.fromList(exp);
}

// Constructs an expression from a section of a list of cards.
Expression.parseFromList = function(cards, indexRef) {
	let index = indexRef.index++;
	if (index < cards.length) {
		let card = Card.get(cards[index]);
		let slots = []
		for (let i = 0; i < card.slots.length; i++) {
			let slot = Expression.parseFromList(cards, indexRef);
			if (slot.card.role !== card.slots[i])
				return null;
			slots.push(slot);
		}
		return new Expression(card, slots);
	} else {
		return null;
	}
}

// Constructs an expression from a list of cards, returning null if the list is not well-formed.
Expression.fromList = function(cards) {
	let indexRef = { index: 0 };
	let res = Expression.parseFromList(cards, indexRef);
	return indexRef.index === cards.length ? res : null;
}

// Appends the cards in this expression to the given list.
Expression.prototype.writeToList = function(cards) {
	cards.push(this.card);
	for (let i = 0; i < this.slots.length; i++)
		this.slots[i].writeToList(cards);
}

// Converts this expression to a list.
Expression.prototype.toList = function() {
	let cards = [];
	this.writeToList(cards);
	return cards;
}


// Represents a set of cards.
function CardSet(counts, totalCount) {
	this.counts = counts;
	this.totalCount = totalCount;
}

// Creates a new card set from the given information.
CardSet.create = function(set) {
	let counts = set;
	if (set instanceof CardSet) {
		counts = set.counts;
	}
	
	let nCounts = { };
	let totalCount = 0;
	for (let card in counts) {
		nCounts[card] = counts[card];
		totalCount += counts[card];
	}
	return new CardSet(nCounts, totalCount);
}

// Creates a new card set from a card list.
CardSet.fromList = function(list) {
	let counts = { };
	let totalCount = 0;
	for (let i = 0; i < list.length; i++) {
		let name = Card.get(list[i]).name;
		counts[name] = (counts[name] || 0) + 1;
		totalCount++;
	}
	return new CardSet(counts, totalCount);
}

// Adds a card to this card set.
CardSet.prototype.insert = function(card) {
	let name = Card.get(card).name;
	this.counts[name] = (this.counts[name] || 0) + 1;
	this.totalCount++;
}

// Tries removing a single copy of the given card from this card set.
CardSet.prototype.remove = function(card) {
	let count = this.counts[Card.get(card).name];
	if (count > 0) {
		this.totalCount -= 1;
		count -= 1;
		if (count > 0) {
			this.counts[card] = count;
		} else {
			delete this.counts[card];
		}
		return true;
	} else {
		return false;
	}
}

// Removes a set of cards from this card set. Fails if the cards are not in this set.
CardSet.prototype.removeSet = function(set) {
	for (let card in set.counts) {
		let nCount = this.counts[card] - set.counts[card];
		if (nCount < 0) throw "Card missing from set";
		this.counts[card] = nCount;
	}
	this.totalCount -= set.totalCount;
}

// Selects and removes a card randomly from this set.
CardSet.prototype.draw = function() {
	let i = Math.floor(Math.random() * this.totalCount);
	for (let card in this.counts) {
		let count = this.counts[card];
		i -= count;
		if (i < 0) {
			this.counts[card] = count - 1;
			this.totalCount -= 1;
			return Card.get(card);
		}
	}
	return null;
}