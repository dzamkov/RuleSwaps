// Identifies the role of card.
var Role = { };
Role[0] = Role.Action = { id: 0, str: "Action" };
Role[1] = Role.Condition = { id: 1, str: "Condition" };
Role[2] = Role.Player = { id: 2, str: "Player" };

// Identifies a type of card in the game (in general, not a specific instance).
function Card(role, text, resolve) {
	this.role = role;
	this.text = text;
	this.resolve = resolve;
	
	// Parse text to determine slots
	var cur = 0;
	var start = 0;
	var state = 0;
	var parts = []
	var slots = []
	var parenthetical = null;
	function emitText() {
		if (start < cur) {
			parts.push(text.substring(start, cur));
		}
	}
	function emitSlot() {
		var str = text.substring(start, cur);
		var role = Role[str];
		if (role) {
			parts.push(role);
			slots.push(role);
		} else {
			throw "Unrecognized role ";
		}
	}
	function emitParenthetical() {
		var str = text.substring(start, cur);
		parenthetical = str;
	}
	while (cur < text.length) {
		var ch = text.charAt(cur);
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

// Creates an element for an instance of this card
Card.prototype.createElement = function() {
	var mainDiv = document.createElement("div");
	mainDiv.className = "card";
	
	var header = document.createElement("div");
	header.className = "card-header " +
		"card-header-" + this.role.str.toLowerCase();
	mainDiv.appendChild(header);
	
	var type = document.createElement("span");
	type.className = "card-type";
	type.innerText = this.role.str;
	header.appendChild(type);
	
	var text = document.createElement("div");
	text.className = "card-text";
	for (var i = 0; i < this.parts.length; i++) {
		var part = this.parts[i];
		if (typeof part === "string") {
			text.appendChild(document.createTextNode(part));
		} else {
			var slot = document.createElement("span");
			slot.className = "card-text-" + part.str.toLowerCase();
			slot.innerText = "(" + part.str + ")";
			text.appendChild(slot);
		}
	}
	mainDiv.appendChild(text);
	
	if (this.parenthetical) {
		var parenthetical = document.createElement("div");
		parenthetical.className = "card-parenthetical";
		parenthetical.innerText = "(" + this.parenthetical + ")";
		mainDiv.appendChild(parenthetical);
	}
	return mainDiv;
};