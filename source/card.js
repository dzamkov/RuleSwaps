// Identifies the role of card.
var Role = { };
Role[0] = Role.Action = { id: 0, str: "Action" };
Role[1] = Role.Condition = { id: 1, str: "Condition" };
Role[2] = Role.Player = { id: 2, str: "Player" };

// Gets a string representing a role or compound role
function getRoleString() {
	
}

// Identifies a type of card in the game (in general, not a specific instance).
function Card(role, slots, value, text, resolve) {
	this.role = role;
	this.slots = slots;
	this.value = value;
	this.text = text;
	this.resolve = resolve;
}

// Creates an element for an instance of this card
Card.prototype.createElement = function() {
	var mainDiv = document.createElement("div");
	mainDiv.className = "card";
	
	var header = document.createElement("div");
	header.className = "card-header " +
		"card-header-" + this.role.str.toLowerCase();
	
	var type = document.createElement("span");
	type.className = "card-type";
	type.innerText = this.role.str;
	
	var value = document.createElement("span");
	value.className = "card-value";
	value.innerText = this.value.toString();
	
	var text = document.createElement("div");
	text.className = "card-text";
	text.innerHTML = this.text
		.replace(/{Action}/, "<span class=\"card-text-action\">(Action)</span>")
		.replace(/{Condition}/, "<span class=\"card-text-condition\">(Condition)</span>")
		.replace(/{Player}/, "<span class=\"card-text-player\">(Player)</span>");
	
	header.appendChild(type);
	header.appendChild(value);
	mainDiv.appendChild(header);
	mainDiv.appendChild(text);
	return mainDiv;
};