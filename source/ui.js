// Contains functions related to game UI.
var UI = new function() {
	
	// Augments an element to be a card. Provides an interface to the element at a logical level.
	function Card(element, type) {
		this.element = element;
		this.type = type;
		element.card = this;
		Motion.styleOnHover(element, "card-hover");
	}
	
	// Creates an element representing a card, and returns its logical interface.
	function createCard(cardType) {
		return new Card(cardType.createElement(), cardType);
	}
	
	// Balances the children of a hand or list of cards
	function handBalanceChildren() {
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
			left = (containerWidth - takenWidth) / 2.0 + paddingLeft;
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
		if (prev && !prev.card) return prev;
		if (next && !next.card) return next;
		
		var hole = document.createElement("div");
		hole.className = "card-exit-hole";
		this.insertBefore(hole, next);
		handBalanceChildren.call(this);
		return hole;
	}
	
	// Cancels a hole within a hand.
	function handCancelHole(hole) {
		this.removeChild(hole);
		handBalanceChildren.call(this);
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
		Motion.enableAccept(element, handAcceptCard, handCancelHole);
		toResize.push(handBalanceChildren.bind(element));
	}
	
	// Draws a new card into this hand.
	Hand.prototype.draw = function(cardType) {
		var card = createCard(cardType);
		this.element.appendChild(card.element);
		Motion.enableDrag(card.element, function() {
			var hole = document.createElement("div");
			hole.className = "card-exit-hole";
			return hole;
		});
		handBalanceChildren.call(this.element);
		return card;
	}
	
	// Register window events
	window.addEventListener("resize", windowResize);
	
	this.Card = Card;
	this.createCard = createCard;
	this.Hand = Hand;
}