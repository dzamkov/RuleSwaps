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
	
	// Merges this card into the given target acceptor.
	Card.prototype.sendTo = function(target) {
		if (target instanceof CardList) {
			let hole = target.createInvisibleHole();
			this.mergeInto(target, hole);
		} else if (target) {
			this.mergeInto(target, target.element);
		} else {
			this.element.parentNode.removeChild(this.element);
		}
	};
	
	// Creates an element representing a card, and returns its logical interface.
	Card.create = function(cardType) {
		return new Card(cardType.createElement(false), cardType);
	};
	
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
	
	// Augments an element to contain a list of cards, where cards are draggable and
	// possibly ordered. Provides an interface to the element at a logical level.
	function CardList(element) {
		Motion.Acceptor.call(this, element);
		this.element = element;
		toResize.push(this.balanceChildren.bind(this, true));
	}
	
	CardList.prototype = Object.create(Motion.Acceptor.prototype);
	
	CardList.prototype.dragOut = function(element) {
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
	
	CardList.prototype.dragIn = function(animated, left, top) {
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
			this.balanceChildren(true);
			return hole;
		}
	}
	
	CardList.prototype.leave = function(animated, hole) {
		this.element.removeChild(hole);
		this.balanceChildren(true);
	};
	
	// Gets the number of cards in this card list.
	CardList.prototype.getNumCards = function() {
		let numCards = 0;
		let children = this.element.children;
		for (let i = 0; i < children.length; i++) {
			let child = children[i];
			if (child.animated instanceof Card)
				numCards++;
		}
		return numCards;
	}
	
	// Gets a list of the card types in this card list.
	CardList.prototype.toList = function() {
		let cards = [];
		let children = this.element.children;
		for (let i = 0; i < children.length; i++) {
			let child = children[i];
			if (child.animated instanceof Card)
				cards.push(child.animated.type);
		}
		return cards;
	};
	
	// Sends all cards in this list to the given target.
	CardList.prototype.sendAllTo = function(target) {
		while (this.element.lastChild) {
			let child = this.element.lastChild;
			if (child.animated instanceof Card) {
				child.animated.sendTo(target);
			} else {
				this.element.removeChild(child);
			}
		}
	};
	
	// Creates a new invisible hold for this card list
	CardList.prototype.createInvisibleHole = function() {
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
		let card = Card.create(cardType);
		card.element.style.position = "fixed";
		card.moveTo(rect.left, rect.right);
		return card;
	}
	
	
	// Augments an element to be the game constitution.
	function Constitution(numbers, list) {
		Motion.Acceptor.call(this, list);
		this.numbers = numbers;
		this.insertPoint = null;
	}
	
	Constitution.prototype = Object.create(Motion.Acceptor.prototype);
	
	// Creates an entry for a constitution.
	Constitution.createEntry = function(exp) {
		let list = createMiniList(exp.toList());
		let entry = document.createElement("div");
		entry.className = "constitution-entry";
		entry.appendChild(list);
		new Motion.Animated(entry);
		return entry;
	}
	
	Constitution.prototype.dragOut = function(element) {
		if (this.insertPoint === element.animated) {
			let hole = document.createElement("div");
			hole.className = "constitution-entry -hole";
			new Motion.Animated(hole);
			this.insertPoint.hole = hole;
			let rect = element.animated.getClientRect();
			element.animated.replace(hole.animated);
			return {
				rect: rect,
				animated: element.animated,
				hole: hole
			}
		}
	}
	
	Constitution.prototype.dragIn = function(animated, left, top, fromAcceptor) {
		
		// Only allow incoming from the same acceptor
		if (fromAcceptor === this) {
			let children = this.element.children;
			let prev = null;
			for (let i = 0; i < children.length; i++) {
				let child = children[i];
				let rect = child.animated.getTargetRect();
				let midY = (rect.top + rect.bottom) / 2.0;
				if (midY < top) {
					prev = child;
				} else {
					break;
				}
			}
			
			let next = prev ? prev.nextSibling : this.element.firstChild;
			if (animated.hole === prev) return prev;
			if (animated.hole === next) return next;
			
			this.element.insertBefore(animated.hole, next);
			this.balanceChildren();
			return animated.hole;
		}
	}
	
	// Populats a constitution from the given list
	Constitution.prototype.populate = function(constitution) {
		for (let i = 0; i < constitution.length; i++) {
			this.element.appendChild(Constitution.createEntry(constitution[i]));
		}
		this.balanceChildren();
	}
	
	// Sets the positions for the items inside a constitution.
	Constitution.prototype.balanceChildren = function() {
		let element = this.element;
		let children = element.children;
		let computedStyle = window.getComputedStyle(element);
		let paddingLeft = parseFloat(computedStyle.paddingLeft || 0);
		let paddingTop = parseFloat(computedStyle.paddingTop || 0);
		let spacing = parseFloat(computedStyle.borderSpacing || 0);
		let top = paddingTop;
		for (let i = 0; i < children.length; i++) {
			children[i].animated.moveTo(paddingLeft, top);
			top += children[i].offsetHeight + spacing;
		}
		
		// Balance numbers to match
		let numbers = this.numbers;
		while (numbers.children.length < children.length) {
			let numbersEntry = document.createElement("div");
			numbersEntry.className = "constitution-number-entry";
			numbersEntry.innerText = numbers.children.length + 1;
			numbers.appendChild(numbersEntry);
		}
		while (numbers.children.length > children.length) {
			numbers.removeChild(numbers.lastChild);
		}
		let bottom = 0;
		for (let i = 0; i < numbers.children.length; i++) {
			let rect = children[i].animated.getTargetRect();
			numbers.children[i].style.top = rect.top + "px";
			numbers.children[i].style.height = (rect.bottom - rect.top) + "px";
			bottom = rect.bottom;
		}
		numbers.style.height = bottom + "px";
	}
	
	// Sets the line that is marked as being executed.
	Constitution.prototype.setActiveLine = function(line) {
		let children = this.element.children;
		for (let i = 0; i < children.length; i++) {
			let child = children[i];
			let className = child.className;
			className = className.replace(" -active", "");
			if (i === line) className += " -active";
			child.className = className;
		}
	}
	
	// Creates a placeholder entry that allows the user to pick an insertion
	// point in the constitution.
	Constitution.prototype.allowInsertPick = function() {
		if (!this.insertPoint) {
			let entry = document.createElement("div");
			entry.className = "constitution-entry -insert-point";
			entry.innerText = "Insert amendment here";
			this.insertPoint = new Motion.Animated(entry);
			this.insertPoint.hoverStyle = "-hover";
			this.element.appendChild(entry);
			this.balanceChildren();
		}
	}
	
	// Removes the ability for the user to select an insertion point.
	Constitution.prototype.cancelInsertPick = function() {
		if (this.insertPoint) {
			this.element.removeChild(this.insertPoint.element);
			this.balanceChildren();
			this.insertPoint = null;
		}
	}
	
	// Upgrades the insertion pick made to this constitution to a proposal.
	Constitution.prototype.proposeInsertPick = function(exp) {
		console.assert(this.insertPoint);
		let entry = Constitution.createEntry(exp);
		let proposal = entry.animated;
		entry.className += " -proposal";
		this.insertPoint.replace(proposal);
		this.balanceChildren();
		this.insertPoint = null;
		
		// Determine line number
		let line = 0;
		let cur = this.element.firstChild;
		while (cur != entry) {
			cur = cur.nextSibling;
			line++;
		}
		proposal.line = line;
		return proposal;
	}
	
	// Creates and insert a proposal into this constitution.
	Constitution.prototype.propose = function(line, exp) {
		let entry = Constitution.createEntry(exp);
		let proposal = entry.animated;
		entry.className += " -proposal";
		this.element.insertBefore(entry, this.element.children[line]);
		this.balanceChildren();
		return proposal;
	}
	
	// Cancels a proposal.
	Constitution.prototype.cancelProposal = function(proposal) {
		this.element.removeChild(proposal.element);
		this.balanceChildren();
	}
	
	// Confirms a proposal.
	Constitution.prototype.confirmProposal = function(proposal) {
		proposal.element.className = proposal.element.className.replace(" -proposal", "");
	}
	
	// Augments an element to be a game log.
	function Log(element) {
		this.element = element;
		element.log = this;
	}
	
	// Identifies a style of log entry.
	Log.Style = {
		Normal: 0,
		Chat: 1,
		Victory: 2
	};
	
	// Builds decorated text consisting of the given parts and adds it to the given
	// element.
	function buildText(element, parts) {
		if (typeof parts === "string") {
			element.appendChild(document.createTextNode(parts));
		} else {
			for (let i = 0; i < parts.length; i++) {
				let part = parts[i];
				if (part instanceof Player || part instanceof User) {
					if (part instanceof Player) part = part.user;
					let user = document.createElement("span");
					user.className = "-user";
					user.innerText = part.name;
					element.appendChild(user);
				} else if (part instanceof Game.Card) {
					element.appendChild(createMiniList([part]));
				} else if (part instanceof Expression) {
					let list = createMiniList(part.toList());
					element.appendChild(list);
				} else if (part instanceof CardSet) {
					let list = createMiniList(part.toList());
					element.appendChild(list);
				} else if (part instanceof Game.Log.Coins) {
					let icon = document.createElement("div");
					icon.className = "icon -mini -coins";
					icon.innerText = part.count;
					element.appendChild(icon);
				} else if (part instanceof Game.Log.Cards) {
					let icon = document.createElement("div");
					icon.className = "icon -mini -cards";
					icon.innerText = part.count;
					element.appendChild(icon);
				} else if (part === Game.Log.Break) {
					element.appendChild(document.createElement("hr"));
				} else if (part instanceof Game.Log.Positive) {
					let span = document.createElement("span");
					span.className = "-positive";
					span.innerText = part.str;
					element.appendChild(span);
				} else if (part instanceof Game.Log.Negative) {
					let span = document.createElement("span");
					span.className = "-negative";
					span.innerText = part.str;
					element.appendChild(span);
				} else {
					element.appendChild(document.createTextNode(part.toString()));
				}
			}
		}
	}
	
	// Sets the text for an element.
	function setText(element, parts) {
		while (element.firstChild) element.removeChild(element.firstChild);
		buildText(element, parts);
	}
	
	// Appends an item to the log.
	Log.prototype.log = function(depth, parts, style) {
		let entry = document.createElement("div");
		let className = "log-entry";
		if (style === Log.Style.Chat) className += " -chat";
		if (style === Log.Style.Victory) className += " -victory";
		entry.className = className;
		entry.style.marginLeft = (depth * 20) + "px";
		buildText(entry, parts);
		this.element.appendChild(entry);
		this.scrollToBottom();
	};

	// Appends a chat message to the log.
	Log.prototype.chat = function(depth, user, message) {
		if (user) {
			this.log(0, [user, ": ", message], Log.Style.Chat);
		} else {
			this.log(0, [message], Log.Style.Chat);
		}
	};
	
	// Scrolls to the bottom of the log.
	Log.prototype.scrollToBottom = function() {
		this.element.scrollTop = this.element.scrollHeight;
	};
	
	// Augments an element to be a button.
	function Button(element) {
		this.element = element;
		element.button = this;
		this.isEnabled = true;
		element.addEventListener("click", (function() { 
			if (this.isEnabled) this.onClick(this);
		}).bind(this));
	}
	
	// Creates a new button.
	Button.create = function(textParts, color) {
		let element = document.createElement("a");
		element.className = "button -medium -" + color;
		setText(element, textParts);
		return new Button(element);
	};
	
	// Sets whether this button is enabled.
	Button.prototype.setEnabled = function(enabled) {
		if (this.isEnabled !== enabled) {
			this.isEnabled = enabled;
			if (enabled) {
				this.element.className = this.element.className.replace(" -disabled", "");
			} else {
				this.element.className += " -disabled";
			}
		}
	}
	
	// Handles a button click.
	Button.prototype.onClick = function() {
		// Override me
	}
	
	
	// Augments a set of elements to display player information.
	function PlayerInfo(player, coins, cards, back) {
		this.coins = coins;
		this.cards = cards;
		this.back = back;
		
		coins.innerText = player.coins;
		cards.innerText = player.handSize;
	}
	
	// Creates a player info section for a non-self player.
	PlayerInfo.create = function(player, isLeft) {
		let container = document.createElement("div");
		let back = document.createElement("div");
		container.appendChild(back);
		
		if (isLeft) {
			container.className = "section-player-left";
			back.className = "section-back-left";
		} else {
			container.className = "section-player-right";
			back.className = "section-back-right";
		}
		
		let name = document.createElement("div");
		name.className = "player-name";
		name.innerText = player.info.name;
		container.appendChild(name);
		
		let info = document.createElement("div");
		info.className = "player-info";
		container.appendChild(info);
		
		let coins = document.createElement("div");
		coins.className = "icon -small -coins";
		info.appendChild(coins);
		
		let cards = document.createElement("div");
		cards.className = "icon -small -cards";
		info.appendChild(cards);
		
		let playerInfo = new PlayerInfo(player, coins, cards, back);
		playerInfo.container = container;
		return playerInfo;
	}
	
	// Triggers an animation class on an element.
	function trigger(element, style) {
		let nStyle = " " + style;
		element.className = element.className.replace(nStyle, "");
		setTimeout(function() { element.className += nStyle; }, 0);
	}
	
	// Sets the number of coins the given player has.
	PlayerInfo.prototype.setCoins = function(coins) {
		this.coins.innerText = coins;
		trigger(this.coins, "-pulse");
	}
	
	// Sets the number of cards the given player has.
	PlayerInfo.prototype.setCards = function(cards) {
		this.cards.innerText = cards;
		trigger(this.cards, "-pulse");
	}
	
	
	// The base class for input interfaces.
	function Input(container) {
		this.container = container;
		this.callback = null;
	}
	
	// Called when a response to an input request is given.
	Input.prototype.respond = function() {
		if (this.callback) this.callback.apply(null, arguments);
		this.callback = null;
		this.container.className = "input -hidden";
	}
	
	// Shows this input interface, requesting a response from the user.
	Input.prototype.request = function(callback) {
		this.container.className = "input";
		this.callback = callback;
	};
	
	// Contains interfaces for specific types of player input.
	(function() {
		
		// Sets a container to display only the given list of buttons.
		function setButtons(container, list, self, onClick) {
			while (container.lastChild) container.removeChild(container.lastChild);
			for (let i = 0; i < list.length; i++) {
				let options = list[i];
				let button = Button.create(options.text, options.color);
				button.onClick = onClick.bind(self, options);
				button.options = options;
				container.appendChild(button.element);
			}
		}
		
		// Sets whether the buttons in the given list are enabled. Buttons with a truthy "pass"
		// option are ignored.
		function setButtonsEnabled(container, enabled) {
			for (let i = 0; i < container.children.length; i++) {
				let button = container.children[i].button;
				if (!button.options.pass) {
					button.setEnabled(enabled);
				}
			}
		}
		
		// Augments a set of elements to be a simple input that allows the user to choose between
		// a given set of options.
		function Options(container) {
			Input.call(this, container);
			this.callback = null;
		}
		
		Options.prototype.onButtonClick = function(options) {
			this.respond(options.value);
		}
		
		Options.prototype.respond = Input.prototype.respond;
		Options.prototype.request = function(options, callback) {
			setButtons(this.container, options.buttons, this, this.onButtonClick);
			Input.prototype.request.call(this, callback);
		};
		
		// Augments a set of elements to be a adjustable payment input.
		function Payment(container, handle, bar, buttons) {
			Input.call(this, container);
			this.handle = handle;
			this.buttons = buttons;
			this.bar = bar;
			this.coins = 0;
			this.limit = 0;

			let payment = this;
			handle.addEventListener("mousedown", function(e) {
				if (e.button === 0 && !window.dragging) {
					e.preventDefault();
					window.dragging = {
						payment: payment,
						move: function(e) {
							let payment = this.payment;
							let barRect = payment.bar.getBoundingClientRect();
							let r = Math.max(e.clientX - barRect.left, 0) / payment.bar.offsetWidth;
							r = Math.min(r, 1);
							let coins = Math.round(r * payment.limit, payment.limit);
							payment.set(coins);
							payment.setPos(r);
						}
					};
				}
			});
		};
		
		// Sets the the relative position of the handle.
		Payment.prototype.setPos = function(r) {
			let x = r * this.bar.offsetWidth;
			this.handle.style.left = x + "px";
		};
		
		// Sets the payment for this input.
		Payment.prototype.set = function(coins) {
			this.coins = coins;
			setButtonsEnabled(this.buttons, !!coins);
			this.handle.innerText = coins;
			let r = coins / this.limit;
			if (!r) r = 0;
			this.setPos(r);
		};
		
		Payment.prototype.onButtonClick = function(options) {
			if (options.pass) {
				this.respond(0, options.value);
			} else {
				this.respond(this.coins, options.value);
			}
		};
		
		Payment.prototype.respond = Input.prototype.respond;
		Payment.prototype.request = function(options, callback) {
			this.limit = options.limit;
			setButtons(this.buttons, options.buttons, this, this.onButtonClick);
			this.set(Math.min(this.coins, this.limit));
			Input.prototype.request.call(this, callback);
		};
		
		// Augments a set of elements to be a cards input.
		function Cards(container, list, buttons) {
			Input.call(this, container);
			this.cardList = new CardList(list);
			this.buttons = buttons;
			this.returnTarget = null;
			this.amount = null;

			let cards = this;

			// Don't accept extra cards
			let oldDragIn = this.cardList.dragIn;
			this.cardList.dragIn = function(animated, left, top, fromAcceptor) {
				if (fromAcceptor === this ||
					!cards.amount ||
					this.getNumCards() < cards.amount)
					return oldDragIn.call(this, animated, left, top, fromAcceptor);
			};

			// Disable on leave
			let oldLeave = this.cardList.leave;
			this.cardList.leave = function(animated, hole, toAcceptor) {
				oldLeave.call(this, animated, hole, toAcceptor);
				cards.updateButtons();
			};

			// Enable if there are enough cards
			let oldAccept = this.cardList.accept;
			this.cardList.accept = function(card, hole, fromAcceptor) {
				oldAccept.call(this, card, hole, fromAcceptor);
				cards.updateButtons();
			};
		};
		
		// Updates the status of the buttons in this input
		Cards.prototype.updateButtons = function() {
			let numCards = this.cardList.getNumCards();
			setButtonsEnabled(this.buttons, numCards > 0 && (!this.amount || this.amount === numCards));
		};
		
		Cards.prototype.onButtonClick = function(options) {
			if (options.pass) {
				this.sendAllTo(this.returnTarget);
				this.respond(null, options.value);
			} else {
				let cards = this.cardList.toList();
				if (cards.length > 0 && (!this.amount || cards.length === this.amount)) {
					this.respond(cards, options.value);
				}
			}
		};
		
		// Sends all cards currently in the card list into the given target. This should not be called
		// during a request.
		Cards.prototype.sendAllTo = function(target) {
			this.cardList.sendAllTo(target);
		};
		
		Cards.prototype.respond = Input.prototype.respond;
		Cards.prototype.request = function(options, callback) {
			this.sendAllTo(null);
			this.amount = options.amount;
			setButtons(this.buttons, options.buttons, this, this.onButtonClick);
			this.updateButtons();
			Input.prototype.request.call(this, callback);
		};
		
		// Augments a set of elements to be an expression input.
		function Expression(container, list, buttons) {
			Motion.Acceptor.call(this, list);
			Input.call(this, container);

			this.list = list;
			this.buttons = buttons;
			this.callback = null;

			this.returnTarget = null;
		};
		
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
		};
		
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
		};
		
		Expression.prototype.leave = function(animated, hole, toAcceptor) {
			hole.holeFor = animated.type.role;
			hole.className = "card-hole-" + hole.holeFor.str.toLowerCase();
			if (toAcceptor) {
				this.removeSlots(hole, animated.type.slots.length);
				this.balanceChildren(false);
			}
			this.updateButtons();
		};
		
		Expression.prototype.accept = function(card, hole, fromAcceptor) {
			Motion.Acceptor.prototype.accept.call(this, card, hole, fromAcceptor);
			if (fromAcceptor) {
				console.assert(fromAcceptor !== this);
				this.addSlots(card.element, card.type.slots);
			}
			this.updateButtons();
		};
		
		// Creates a hole element for a slot of the given role.
		Expression.createSlotHole = function(role, isActive) {
			let hole = document.createElement("div");
			let className = "card-hole-" + role.str.toLowerCase();
			if (isActive) className += "-active";
			hole.holeFor = role;
			hole.className = className;
			new Motion.Animated(hole);
			return hole;
		};
		
		// Sets the expected role of the expression specified using this input.
		Expression.prototype.expect = function(role) {
			while (this.list.lastChild) this.list.removeChild(this.list.lastChild);
			this.list.appendChild(Expression.createSlotHole(role, false));
			this.balanceChildren(false);
		};
		
		// Adds slots to an expression after the given card element.
		Expression.prototype.addSlots = function(after, slots) {
			let before = after.nextSibling;
			for (let i = 0; i < slots.length; i++) {
				let hole = Expression.createSlotHole(slots[i], false);
				this.list.insertBefore(hole, before);
				before = hole.nextSibling;
			}
			this.balanceChildren(false);
		};
		
		// Removes a certain number slots from an expression after the given card element.
		Expression.prototype.removeSlots = function(after, count) {
			for (let i = 0; i < count; i++) {
				let child = after.nextSibling;
				if (child.animated instanceof Card) {
					child.animated.sendTo(this.returnTarget);
					this.removeSlots(after, child.animated.type.slots.length);
				} else {
					this.list.removeChild(child);
				}
			}
			this.balanceChildren(false);
		};
		
		// Updates the status of the buttons in this input
		Expression.prototype.updateButtons = function() {
			// Check if all slots have been filled
			let children = this.list.children;
			let allFilled = true;
			for (let i = 0; i < children.length; i++) {
				allFilled &= children[i].animated instanceof Card;
			}
			setButtonsEnabled(this.buttons, allFilled);
		};
		
		Expression.prototype.onButtonClick = function(options) {
			if (options.pass) {
				this.sendAllTo(this.returnTarget);
				this.respond(null, options.value);
			} else {

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
				this.respond(exp, options.value);
			}
		};
		
		// Sends all cards currently in the expression into the given target. This should not be called
		// during a request.
		Expression.prototype.sendAllTo = function(target) {
			while (this.list.lastChild) {
				let child = this.list.lastChild;
				if (child.animated instanceof Card) {
					child.animated.sendTo(target);
				} else {
					this.list.removeChild(child);
				}
			}
		};
		
		Expression.prototype.respond = Input.prototype.respond;
		Expression.prototype.request = function(options, callback) {
			this.expect(options.role);
			setButtons(this.buttons, options.buttons, this, this.onButtonClick);
			this.updateButtons();
			Input.prototype.request.call(this, callback);
		};
		
		this.Options = Options;
		this.Payment = Payment;
		this.Cards = Cards;
		this.Expression = Expression;
		
	}).call(Input);
	
	// Augments a set of elements to be a chat input.
	function Chat(selector, textbox, button) {
		this.selector = selector;
		this.textbox = textbox;
		this.button = new Button(button);

		this.button.onClick = this.post.bind(this);
		this.textbox.addEventListener("keypress", (function(e) {
			if (e.keyCode === 13) {
				e.preventDefault();
				this.post();
			}
		}).bind(this));
	};
	
	// Says the current contents of the chatbox, if non-empty.
	Chat.prototype.post = function() {
		if (this.textbox.value) {
			this.onSay(null, this.textbox.value); // TODO: Recipient
			this.textbox.value = "";
		}
	};
	
	// An event fired when something is said using the chatbox.
	Chat.prototype.onSay = function(recipient, message) {
		// Override me
	};
	
	// Register window events
	window.addEventListener("resize", windowResize);
	
	this.Card = Card;
	this.Deck = Deck;
	this.CardList = CardList;
	this.Constitution = Constitution;
	this.Log = Log;
	this.Button = Button;
	this.PlayerInfo = PlayerInfo;
	this.Input = Input;
	this.Chat = Chat;
}