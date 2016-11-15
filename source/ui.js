// Creates an element for an instance of this card
Card.prototype.createElement = function() {
	let mainDiv = document.createElement("div");
	mainDiv.className = "card";
	
	let header = document.createElement("div");
	header.className = "card-header " +
		"card-header-" + this.role.str.toLowerCase();
	mainDiv.appendChild(header);
	
	let type = document.createElement("span");
	type.className = "card-type";
	type.innerText = this.role.str;
	header.appendChild(type);
	
	let text = document.createElement("div");
	text.className = "card-text";
	for (let i = 0; i < this.parts.length; i++) {
		let part = this.parts[i];
		if (typeof part === "string") {
			text.appendChild(document.createTextNode(part));
		} else {
			let slot = document.createElement("span");
			slot.className = "card-text-" + part.str.toLowerCase();
			slot.innerText = "(" + part.str + ")";
			text.appendChild(slot);
		}
	}
	mainDiv.appendChild(text);
	
	if (this.parenthetical) {
		let parenthetical = document.createElement("div");
		parenthetical.className = "card-parenthetical";
		parenthetical.innerText = "(" + this.parenthetical + ")";
		mainDiv.appendChild(parenthetical);
	}
	return mainDiv;
};

// Contains functions related to game UI.
let UI = new function() {
	
	// Augments an element to be a card. Provides an interface to the element at a logical level.
	function Card(element, type) {
		this.element = element;
		this.type = type;
		this.expression = null;
		element.card = this;
		Motion.styleOnHover(element, "card-hover");
	}
	
	// Enables a card to be dragged between acceptors
	Card.prototype.enableDrag = function() {
		Motion.enableDrag(this.element, function() {
			let expression = this.card.expression;
			let hole;
			if (expression) {
				hole = createSlotHole(this.card.type.role);
			} else {
				hole = document.createElement("div");
				hole.className = "card-hole";
			}
			hole.holeFor = this;
			return hole;
		}, function(dest) {
			let card = this.card;
			let expression = dest.parentNode.expression;
			Motion.replace(dest, this);
			if (expression) {
				if (card.expression !== expression) {
					card.expression = expression;
					expression.addSlots(this, card.type.slots);
				}
			} else {
				card.expression = null;
			}
		});
	}
	
	// Creates an element representing a card, and returns its logical interface.
	function createCard(cardType) {
		return new Card(cardType.createElement(), cardType);
	}
	
	
	
	// Balances the children of a hand or list of cards
	function balanceChildren(shouldCenter) {
		let children = this.children;
		let computedStyle = window.getComputedStyle(this);
		let paddingLeft = parseFloat(computedStyle.paddingLeft || 0);
		let paddingRight = parseFloat(computedStyle.paddingRight || 0);
		let paddingTop = parseFloat(computedStyle.paddingTop || 0);
		let containerWidth = this.clientWidth - paddingLeft - paddingRight;
		let spacing = parseFloat(computedStyle.borderSpacing || 0);
		let takenWidth = spacing * (children.length - 1);
		let lastWidth = 0;
		for (let i = 0; i < children.length; i++) {
			takenWidth += (lastWidth = children[i].offsetWidth);
		}
		
		let left, compression;
		if (takenWidth < containerWidth) {
			left = (shouldCenter ? (containerWidth - takenWidth) / 2.0 : 0) + paddingLeft;
			compression = 1.0;
		} else {
			left = paddingLeft;
			compression = (containerWidth - lastWidth) / (takenWidth - lastWidth);
		}
		for (let i = 0; i < children.length; i++) {
			Motion.moveTo(children[i], left, paddingTop);
			left += (children[i].offsetWidth + spacing) * compression;
		}
	}
	
	// Accepts a card into a hand of cards.
	function handAcceptCard(incoming, left, top) {
		let card = incoming.card;
		if (card) {
			let children = this.children;
			let prev = null;
			for (let i = 0; i < children.length; i++) {
				let child = children[i];
				let rect = Motion.getTargetRect(child);
				let midX = (rect.left + rect.right) / 2.0;
				if (midX < left) {
					prev = child;
				} else {
					break;
				}
			}
			let next = prev ? prev.nextSibling : this.firstChild;
			if (prev && prev.holeFor === incoming) return prev;
			if (next && next.holeFor === incoming) return next;
			
			let hole = document.createElement("div");
			hole.holeFor = incoming;
			hole.className = "card-hole";
			this.insertBefore(hole, next);
			balanceChildren.call(this, true);
			return hole;
		}
	}
	
	// Cancels a hole within a hand.
	function handCancelHole(hole) {
		this.removeChild(hole);
		balanceChildren.call(this, true);
	}
	
	// Handles window resizing
	let toResize = [];
	function windowResize(e) {
		for (let i = 0; i < toResize.length; i++)
			toResize[i]();
	}
	
	// Augments an element to be a hand of cards, where cards are draggable and need
	// not be in any particular order. Provides an interface to the element at a logical level.
	function Hand(element) {
		this.element = element;
		element.hand = this;
		Motion.enableAccept(element, handAcceptCard, handCancelHole);
		toResize.push(balanceChildren.bind(element, true));
	}
	
	// Draws a new card into this hand.
	Hand.prototype.draw = function(cardType) {
		let card = createCard(cardType);
		card.enableDrag();
		this.element.appendChild(card.element);
		balanceChildren.call(this.element, true);
		return card;
	}
	
	
	// Accepts a card into an expression.
	function expressionAcceptCard(incoming, left, top) {
		if (incoming.card) {
			
			// Don't allow incoming cards from the same expression
			if (incoming.card.expression !== this.expression) {
				let children = this.children;
				let cur = null;
				let bestDis = Infinity;
				for (let i = 0; i < children.length; i++) {
					let child = children[i];
					let rect = Motion.getTargetRect(child);
					let midX = (rect.left + rect.right) / 2.0;
					let dis = Math.abs(midX - left);
					if (dis < bestDis) {
						cur = child;
						bestDis = dis;
					}
				}
				
				if (cur) {
					let role = incoming.card.type.role;
					if (cur.holeFor === incoming) {
						return cur;
					} else if (cur.holeFor === role) {
						cur.holeFor = incoming;
						cur.className = "card-hole-" + role.str.toLowerCase() + "-active";
						return cur;
					}
				}
				return null;
			}
		}
	}
	
	// Cancels a hole within an expression.
	function expressionCancelHole(hole, isExiting) {
		console.assert(hole.holeFor instanceof HTMLElement);
		if (isExiting) {
			let type = hole.holeFor.card.type;
			hole.holeFor = type.role;
			this.expression.removeSlots(hole, type.slots.length);
		} else {
			hole.holeFor = hole.holeFor.card.type.role;
			hole.className = "card-hole-" + hole.holeFor.str.toLowerCase();
		}
	}
	
	// Augments an element to be a list of cards representing an expression.
	function Expression(element) {
		this.element = element;
		element.expression = this;
		Motion.enableAccept(element, expressionAcceptCard, expressionCancelHole);
	}
	
	// Creates a hole element for a slot of the given role.
	function createSlotHole(role) {
		let hole = document.createElement("div");
		hole.holeFor = role;
		hole.className = "card-hole-" + role.str.toLowerCase();
		return hole;
	}
	
	// Allows the user to specify an expression of the given role in this element by dragging. This may only
	// be called if the expression is empty.
	Expression.prototype.expect = function(role) {

		this.element.appendChild(createSlotHole(role));
		balanceChildren.call(this.element, false);
	}
	
	// Adds slots to an expression after the given card element.
	Expression.prototype.addSlots = function(after, slots) {
		let before = after.nextSibling;
		for (let i = 0; i < slots.length; i++) {
			let hole = createSlotHole(slots[i]);
			this.element.insertBefore(hole, before);
			before = hole.nextSibling;
		}
		balanceChildren.call(this.element, false);
	}
	
	// Removes a certain number slots from an expression after the given card element.
	Expression.prototype.removeSlots = function(after, count) {
		for (let i = 0; i < count; i++) {
			let child = after.nextSibling;
			this.element.removeChild(child);
		}
		balanceChildren.call(this.element, false);
	}
	
	// Creates a list of miniaturized cards that expand on mouse over. 
	function createMiniList(cards) {
		let container = document.createElement("span");
		for (var i = 0; i < cards.length; i++) {
			var card = document.createElement("div");
			card.className = "mini-card-" + cards[i].role.str.toLowerCase();
			container.appendChild(card);
		}
		return container;
	}
	
	// Augments an element to be a game log.
	function Log(element) {
		this.element = element;
		element.log = this;
	}
	
	// Appends an item to the log.
	Log.prototype.log = function(depth, parts) {
		let entry = document.createElement("div");
		entry.className = "log-entry";
		entry.style.marginLeft = (depth * 20) + "px";
		for (let i = 0; i < parts.length; i++) {
			var part = parts[i];
			if (typeof part === "string") {
				entry.appendChild(document.createTextNode(part));
			} else if (part instanceof Player) {
				var player = document.createElement("span");
				player.className = "log-entry-player";
				player.innerText = part.name;
				entry.appendChild(player);
			} else if (part instanceof window.Expression) {
				var list = createMiniList(part.toList());
				entry.appendChild(list);
			}
		}
		this.element.appendChild(entry);
	}
	
	// Register window events
	window.addEventListener("resize", windowResize);
	
	this.Card = Card;
	this.createCard = createCard;
	this.Hand = Hand;
	this.Expression = Expression;
	this.Log = Log;
}