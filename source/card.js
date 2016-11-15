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


// Describes an expression made up of cards.
function Expression(card, slots) {
	this.card = card;
	this.slots = slots;
}

// Constructs an expression from a section of a list of cards.
Expression.parseFromList = function(cards, indexRef) {
	let index = indexRef.index++;
	if (index < cards.length) {
		let card = cards[index];
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