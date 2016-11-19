// Creates an element for an instance of this card
Card.prototype.createElement = function(isMini) {
	let mainDiv = document.createElement("div");
	mainDiv.className = isMini ? "mini-card" : "card";
	mainDiv.className += " -" + this.role.str.toLowerCase();;
	
	let contentDiv;
	if (isMini) {
		contentDiv = mainDiv;
	} else {
		contentDiv = document.createElement("div");
		contentDiv.className = "card-content";
		mainDiv.appendChild(contentDiv);
	}
	
	if (!isMini) {
		let header = document.createElement("div");
		header.className = "card-header";
		contentDiv.appendChild(header);
		
		let type = document.createElement("span");
		type.className = "card-type";
		type.innerText = this.role.str;
		header.appendChild(type);
	}
	
	let text = document.createElement("div");
	text.className = "card-text";
	if (isMini) text.className += " -mini";
	for (let i = 0; i < this.parts.length; i++) {
		let part = this.parts[i];
		if (typeof part === "string") {
			text.appendChild(document.createTextNode(part));
		} else {
			let slot = document.createElement("span");
			slot.className = "-" + part.str.toLowerCase();
			slot.innerText = "(" + part.str + ")";
			text.appendChild(slot);
		}
	}
	contentDiv.appendChild(text);
	
	if (!isMini && this.parenthetical) {
		let parenthetical = document.createElement("div");
		parenthetical.className = "card-parenthetical";
		parenthetical.innerText = "(" + this.parenthetical + ")";
		contentDiv.appendChild(parenthetical);
	}
	return mainDiv;
};

// Contains functions related to game UI.
let UI = new function() {
	
	// Augments an element to be a draggable card. Provides an interface to the element at a
	// logical level.
	function Card(element, type) {
		Motion.Animated.call(this, element);
		this.type = type;
		this.hoverStyle = "-hover";
	}
	
	Card.prototype = Object.create(Motion.Animated.prototype);
	
	// Creates an element representing a card, and returns its logical interface.
	function createCard(cardType) {
		return new Card(cardType.createElement(false), cardType);
	}
	
	// Balances the children of a hand or list of cards
	Motion.Acceptor.prototype.balanceChildren = function(shouldCenter) {
		let element = this.element;
		let children = element.children;
		let computedStyle = window.getComputedStyle(element);
		let paddingLeft = parseFloat(computedStyle.paddingLeft || 0);
		let paddingRight = parseFloat(computedStyle.paddingRight || 0);
		let paddingTop = parseFloat(computedStyle.paddingTop || 0);
		let containerWidth = element.clientWidth - paddingLeft - paddingRight;
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
			children[i].animated.moveTo(left, paddingTop);
			left += (children[i].offsetWidth + spacing) * compression;
		}
	}
	
	// Handles window resizing
	let toResize = [];
	function windowResize(e) {
		for (let i = 0; i < toResize.length; i++)
			toResize[i]();
	}
	
	// Augments an element to be a hand of cards, where cards are draggable and need
	// not be in any particular order. Provides an interface to the element at a logical level.
	function Hand(element, cards) {
		Motion.Acceptor.call(this, element);
		this.element = element;
		toResize.push(this.balanceChildren.bind(this, true));
	}
	
	Hand.prototype = Object.create(Motion.Acceptor.prototype);
	
	Hand.prototype.dragOut = function(element) {
		if (element.animated instanceof Card) {
			let hole = document.createElement("div");
			hole.className = "card-hole";
			hole.holeFor = element.animated;
			let rect = element.animated.getClientRect();
			element.animated.replace(new Motion.Animated(hole));
			return {
				rect: rect,
				animated: element.animated,
				hole: hole
			}
		}
	}
	
	Hand.prototype.dragIn = function(animated, left, top) {
		let card = animated;
		if (card instanceof Card) {
			let children = this.element.children;
			let prev = null;
			for (let i = 0; i < children.length; i++) {
				let child = children[i];
				let rect = child.animated.getTargetRect();
				let midX = (rect.left + rect.right) / 2.0;
				if (midX < left) {
					prev = child;
				} else {
					break;
				}
			}
			let next = prev ? prev.nextSibling : this.element.firstChild;
			if (prev && prev.holeFor === card) return prev;
			if (next && next.holeFor === card) return next;
			
			let hole = document.createElement("div");
			hole.holeFor = card;
			hole.className = "card-hole";
			new Motion.Animated(hole);
			this.element.insertBefore(hole, next);
			this.balanceChildren(this, true);
			return hole;
		}
	}
	
	Hand.prototype.leave = function(animated, hole, isOriginalElement) {
		this.element.removeChild(hole);
		this.balanceChildren(true);
	}
	
	// Creates a new invisible hold for this hand
	Hand.prototype.createInvisibleHole = function() {
		let hole = document.createElement("div");
		hole.className = "card-hole";
		new Motion.Animated(hole);
		this.element.appendChild(hole);
		this.balanceChildren(true);
		return hole;
	}
	
	// Creates a list of miniaturized cards that expands on mouse over. 
	function createMiniList(cards) {
		let container = document.createElement("div");
		container.className = "mini-card-list";
		for (var i = 0; i < cards.length; i++) {
			container.appendChild(cards[i].createElement(true));
		}
		return container;
	}
	
	// Augments an element to be a deck container.
	function Deck(element, isFaceDown) {
		Motion.Acceptor.call(this, element);
		this.isFaceDown = isFaceDown;
		
		let card = document.createElement("div");
		card.className = "card-back";
		element.appendChild(card);
	}
	
	Deck.prototype = Object.create(Motion.Acceptor.prototype);

	// Pulls a card of the given type from this deck.
	Deck.prototype.pull = function(cardType) {
		let rect = this.element.getBoundingClientRect();
		let card = createCard(cardType);
		card.element.style.position = "fixed";
		card.moveTo(rect.left, rect.right);
		return card;
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
		let scrollToBottom = this.element.scrollTop >
			this.element.scrollHeight - this.element.offsetHeight - 30;
		this.element.appendChild(entry);
		if (scrollToBottom) this.element.scrollTop = this.element.scrollHeight;
	}
	
	// Augments an element to be a button.
	function Button(element) {
		this.element = element;
		this.isDisabled = false;
		element.addEventListener("click", (function() { 
			if (!this.isDisabled) this.onClick(this);
		}).bind(this));
	}
	
	// Sets a button to be disabled.
	Button.prototype.disable = function() {
		if (!this.isDisabled) {
			this.isDisabled = true;
			this.element.className += " -disabled";
		}
	}
	
	// Sets a button to be enabled.
	Button.prototype.enable = function() {
		if (this.isDisabled) {
			this.isDisabled = false;
			this.element.className = this.element.className.replace(" -disabled", "");
		}
	}
	
	// Handles a button click.
	Button.prototype.onClick = function() {
		// Override me
	}
	
	// Register window events
	window.addEventListener("resize", windowResize);
	
	// Contains interfaces for specific types of player input.
	let Input = new function() {
		
		// Augments an element to be a list of cards representing an expression.
		function Expression(container, list, acceptButton, passButton) {
			Motion.Acceptor.call(this, list);
			
			this.container = container;
			this.list = list;
			this.acceptButton = new Button(acceptButton);
			this.passButton = new Button(passButton);
			this.callback = null;
			
			this.returnHand = null;
			this.playDeck = null;
			
			this.acceptButton.onClick = this.inputAccept.bind(this);
			this.passButton.onClick = this.inputPass.bind(this);
		}
		
		Expression.prototype = Object.create(Motion.Acceptor.prototype);
		
		Expression.prototype.dragOut = function(element) {
			if (element.animated instanceof Card) {
				let hole = Expression.createSlotHole(element.animated.type.role, true);
				hole.holeFor = element.animated;
				let rect = element.animated.getClientRect();
				element.animated.replace(hole.animated);
				return {
					rect: rect,
					animated: element.animated,
					hole: hole
				}
			}
		}
		
		Expression.prototype.dragIn = function(card, left, top, fromAcceptor) {
			
			// Don't allow incoming cards from the same expression
			if (fromAcceptor !== this && card instanceof Card) {
				let children = this.element.children;
				let cur = null;
				let bestDis = Infinity;
				for (let i = 0; i < children.length; i++) {
					let child = children[i];
					let rect = child.animated.getTargetRect();
					let midX = (rect.left + rect.right) / 2.0;
					let dis = Math.abs(midX - left);
					if (dis < bestDis) {
						cur = child;
						bestDis = dis;
					}
				}
				
				if (cur) {
					let role = card.type.role;
					if (cur.holeFor === card) {
						return cur;
					} else if (cur.holeFor === role) {
						cur.holeFor = card;
						cur.className = "card-hole-" + role.str.toLowerCase() + "-active";
						return cur;
					}
				}
				return null;
			}
		}
		
		Expression.prototype.leave = function(animated, hole, isOriginalElement) {
			hole.holeFor = animated.type.role;
			hole.className = "card-hole-" + hole.holeFor.str.toLowerCase();
			if (isOriginalElement) {
				this.removeSlots(hole, animated.type.slots.length);
				this.balanceChildren(false);
			}
			this.acceptButton.disable();
		}
		
		Expression.prototype.accept = function(card, hole) {
			Motion.Acceptor.prototype.accept.call(this, card, hole);
			this.addSlots(card.element, card.type.slots);
			
			// Check if all slots have been filled
			let children = this.list.children;
			let allFilled = true;
			for (let i = 0; i < children.length; i++) {
				allFilled &= children[i].animated instanceof Card;
			}
			if (allFilled)
				this.acceptButton.enable();
		}
		
		// Creates a hole element for a slot of the given role.
		Expression.createSlotHole = function(role, isActive) {
			let hole = document.createElement("div");
			let className = "card-hole-" + role.str.toLowerCase();
			if (isActive) className += "-active";
			hole.holeFor = role;
			hole.className = className;
			new Motion.Animated(hole);
			return hole;
		}
		
		// Allows the user to specify an expression of the given role in this element by dragging. This may only
		// be called if the expression is empty.
		Expression.prototype.expect = function(role) {
			this.list.appendChild(Expression.createSlotHole(role, false));
			this.balanceChildren(false);
		}
		
		// Adds slots to an expression after the given card element.
		Expression.prototype.addSlots = function(after, slots) {
			let before = after.nextSibling;
			for (let i = 0; i < slots.length; i++) {
				let hole = Expression.createSlotHole(slots[i], false);
				this.list.insertBefore(hole, before);
				before = hole.nextSibling;
			}
			this.balanceChildren(false);
		}
		
		// Removes a certain number slots from an expression after the given card element.
		Expression.prototype.removeSlots = function(after, count) {
			for (let i = 0; i < count; i++) {
				let child = after.nextSibling;
				if (child.animated instanceof Card) {
					this.removeCard(child.animated, false)
					this.removeSlots(after, child.animated.type.slots.length);
				} else {
					this.list.removeChild(child);
				}
			}
			this.balanceChildren(false);
		}
		
		// Tries the input currently in the expression.
		Expression.prototype.inputAccept = function() {
			
			// Build expression
			let cards = [];
			let children = this.element.children;
			for (let i = 0; i < children.length; i++) {
				let child = children[i];
				if (child.animated instanceof Card) {
					cards.push(child.animated.type);
				} else {
					console.assert(false, "Expression still contains holes");
					return;
				}
			}
			let exp = window.Expression.fromList(cards);
			if (!exp) {
				console.assert(false, "Expression is invalid");
				return;
			}
			
			// Reset and callback
			this.reset(true);
			if (this.callback) this.callback(exp);
		}
		
		// Cancels input in this expression.
		Expression.prototype.inputPass = function() {
			this.reset(false);
			if (this.callback) this.callback(null);
		}
		
		// Removes a card from this expression, either returning it to the hand, or putting
		// it in the in-play deck.
		Expression.prototype.removeCard = function(card, inPlay) {
			if (inPlay && this.playDeck) {
				card.mergeInto(this.playDeck, this.playDeck.element);
			} else if (!inPlay && this.returnHand) {
				let hole = this.returnHand.createInvisibleHole();
				card.mergeInto(this.returnHand, hole);
			} else {
				this.list.removeChild(card.element);
			}
		}
		
		// Resets the expression input, removing all children
		Expression.prototype.reset = function(inPlay) {
			this.container.className = "input-hidden";
			while (this.list.firstChild) {
				let element = this.list.firstChild;
				if (element.animated instanceof Card) {
					this.removeCard(element.animated, inPlay)
				} else {
					this.list.removeChild(this.list.firstChild);
				}
			}
		}
		
		// Shows the expression input, requesting that the user specifies an expression of the given role.
		Expression.prototype.request = function(role, style, callback) {
			console.assert(this.list.children.length === 0);
			this.expect(role);
			this.acceptButton.disable();
			this.container.className = "";
			this.callback = callback;
		}
		
		this.Expression = Expression;
	}
	
	this.Card = Card;
	this.createCard = createCard;
	this.Deck = Deck;
	this.Hand = Hand;
	this.Log = Log;
	this.Button = Button;
	this.Input = Input;
}