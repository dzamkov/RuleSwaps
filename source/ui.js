// Contains functions related to game UI.
var UI = new function() {
	
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
			var expression = this.card.expression;
			var hole;
			if (expression) {
				hole = createSlotHole(this.card.type.role);
			} else {
				hole = document.createElement("div");
				hole.className = "card-hole";
			}
			hole.holeFor = this;
			return hole;
		}, function(dest) {
			var card = this.card;
			var expression = dest.parentNode.expression;
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
		var children = this.children;
		var computedStyle = window.getComputedStyle(this);
		var paddingLeft = parseFloat(computedStyle.paddingLeft || 0);
		var paddingRight = parseFloat(computedStyle.paddingRight || 0);
		var paddingTop = parseFloat(computedStyle.paddingTop || 0);
		var containerWidth = this.clientWidth - paddingLeft - paddingRight;
		var spacing = parseFloat(computedStyle.borderSpacing || 0);
		var takenWidth = spacing * (children.length - 1);
		var lastWidth = 0;
		for (var i = 0; i < children.length; i++) {
			takenWidth += (lastWidth = children[i].offsetWidth);
		}
		
		var left, compression;
		if (takenWidth < containerWidth) {
			left = (shouldCenter ? (containerWidth - takenWidth) / 2.0 : 0) + paddingLeft;
			compression = 1.0;
		} else {
			left = paddingLeft;
			compression = (containerWidth - lastWidth) / (takenWidth - lastWidth);
		}
		for (var i = 0; i < children.length; i++) {
			Motion.moveTo(children[i], left, paddingTop);
			left += (children[i].offsetWidth + spacing) * compression;
		}
	}
	
	// Accepts a card into a hand of cards.
	function handAcceptCard(incoming, left, top) {
		var card = incoming.card;
		if (card) {
			var children = this.children;
			var prev = null;
			for (var i = 0; i < children.length; i++) {
				var child = children[i];
				var rect = Motion.getTargetRect(child);
				var midX = (rect.left + rect.right) / 2.0;
				if (midX < left) {
					prev = child;
				} else {
					break;
				}
			}
			var next = prev ? prev.nextSibling : this.firstChild;
			if (prev && prev.holeFor === incoming) return prev;
			if (next && next.holeFor === incoming) return next;
			
			var hole = document.createElement("div");
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
	var toResize = [];
	function windowResize(e) {
		for (var i = 0; i < toResize.length; i++)
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
		var card = createCard(cardType);
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
				var children = this.children;
				var cur = null;
				var bestDis = Infinity;
				for (var i = 0; i < children.length; i++) {
					var child = children[i];
					var rect = Motion.getTargetRect(child);
					var midX = (rect.left + rect.right) / 2.0;
					var dis = Math.abs(midX - left);
					if (dis < bestDis) {
						cur = child;
						bestDis = dis;
					}
				}
				
				if (cur) {
					var role = incoming.card.type.role;
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
			var type = hole.holeFor.card.type;
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
		var hole = document.createElement("div");
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
		var before = after.nextSibling;
		for (var i = 0; i < slots.length; i++) {
			var hole = createSlotHole(slots[i]);
			this.element.insertBefore(hole, before);
			before = hole.nextSibling;
		}
		balanceChildren.call(this.element, false);
	}
	
	// Removes a certain number slots from an expression after the given card element.
	Expression.prototype.removeSlots = function(after, count) {
		for (var i = 0; i < count; i++) {
			var child = after.nextSibling;
			this.element.removeChild(child);
		}
		balanceChildren.call(this.element, false);
	}
	
	// Register window events
	window.addEventListener("resize", windowResize);
	
	this.Card = Card;
	this.createCard = createCard;
	this.Hand = Hand;
	this.Expression = Expression;
}