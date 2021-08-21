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
	
	// Header
	if (!isMini) {
		let header = document.createElement("div");
		header.className = "card-header";
		contentDiv.appendChild(header);
		
		let type = document.createElement("span");
		type.className = "card-type";
		type.innerText = this.role.str;
		header.appendChild(type);
	}
	
	// Text content
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
	
	// Parenthetical
	if (!isMini && this.parenthetical) {
		let parenthetical = document.createElement("div");
		parenthetical.className = "card-parenthetical";
		parenthetical.innerText = "(" + this.parenthetical + ")";
		contentDiv.appendChild(parenthetical);
	}

	// Hover-over zoom for mini cards
	if (isMini) {
		let card = this;
		mainDiv.zoom = null;
		function createZoom() {
			if (!mainDiv.zoom) {
				let rect = mainDiv.getBoundingClientRect();
				let zoom = card.createElement(false);
				zoom.className += " -zoom";
				zoom.style.position = "fixed";
				zoom.style.left = (rect.left + rect.right) / 2.0 + "px";
				zoom.style.top = (rect.top + rect.bottom) / 2.0 + "px";
				document.body.appendChild(zoom);
				mainDiv.zoom = zoom;
			}
		}
		function destroyZoom() {
			if (mainDiv.zoom) {
				document.body.removeChild(mainDiv.zoom);
				mainDiv.zoom = null;
			}
		}

		mainDiv.addEventListener("mouseenter", function(e) {
			if ((e.buttons & 1) === 1) createZoom();
		});
		mainDiv.addEventListener("mousedown", function(e) {
			if ((e.buttons & 1) === 1) createZoom();
		});
		mainDiv.addEventListener("mouseleave", function() {
			destroyZoom();
		});
		mainDiv.addEventListener("mouseup", function(e) {
			if ((e.buttons & 1) !== 1) destroyZoom();
		});
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
	Card.create = function(cardType) {
		return new Card(cardType.createElement(false), cardType);
	};

	// Augments an element to contain a list of cards, where cards are draggable and
	// possibly ordered. Provides an interface to the element at a logical level.
	function CardList(element) {
		Motion.Acceptor.call(this, element);
		this.element = element;
	}
	
	CardList.prototype = Object.create(Motion.Acceptor.prototype);

	// Creates a new placeholder element for a card.
	CardList.createHole = function(card) {
		let hole = document.createElement("div");
		hole.className = "card-hole";
		hole.holeFor = card;
		new Motion.Animated(hole);
		return hole;
	};
	
	CardList.prototype.dragGrab = function(element) {
		let card = Motion.Animated.get(element);
		if (card instanceof Card) {
			card.pin();

			if (card.element.parentNode.holeFor === card) {
				card.hole = card.element.parentNode;
			} else {
				let hole = CardList.createHole(card);
				card.element.parentNode.replaceChild(hole, card.element);
				card.hole = hole;
			}
			return card;
		}
		return null;
	};

	CardList.prototype.dragRelease = function(animated) {
		animated.settleInto(animated.hole);
		animated.hole = null;
	};

	CardList.prototype.dragEnterMove = function(card, left, top, fromAcceptor) {
		if (card instanceof Card) {
			let prev = null;
			let next = this.element.firstChild;
			while (next !== null) {
				let item = next.firstChild;
				let rect = Motion.getTargetRect(this.element, item);
				let midX = rect.left + rect.width / 2.0;
				if (midX < left) {
					prev = next;
					next = next.nextSibling;
				} else {
					break;
				}
			}

			// Quit early if possible.
			if (prev && card.hole === prev.firstChild) return true;
			if (next && card.hole === next.firstChild) return true;

			// Add to this acceptor
			Motion.Animated.pinAll(this.element);
			if (fromAcceptor !== this) {
				fromAcceptor.dragLeave(card);

				let hole = CardList.createHole(card);
				let container = document.createElement("div");
				container.className = "card-container";
				container.appendChild(hole);
				card.hole = hole;
				this.element.insertBefore(container, next);
			} else {
				this.element.insertBefore(card.hole.parentNode, next);
			}
			return true;
		}
		return false;
	};

	CardList.prototype.dragLeave = function(card) {
		this.removeCard(card);
	};

	// Removes a card from this list.
	CardList.prototype.removeCard = function(card) {
		Motion.Animated.pinAll(this.element);
		if (card.hole) {
			this.element.removeChild(card.hole.parentNode);
		} else {
			this.element.removeChild(card.element.parentNode);
		}
	};

	// Appends a card to this list.
	CardList.prototype.appendCard = function(card) {
		Motion.Animated.pinAll(this.element);
		let container = document.createElement("div");
		container.className = "card-container";
		container.appendChild(card.element);
		this.element.appendChild(container);
	};

	// Default putting to appending.
	CardList.prototype.putCard = CardList.prototype.appendCard;
	
	// Gets the number of cards in this card list.
	CardList.prototype.getNumCards = function() {
		let numCards = 0;
		for (let container of this.element.children) {
			let item = container.firstChild;
			if (item.animated instanceof Card) {
				numCards++;
			} else if (item.holeFor instanceof Card) {
				numCards++;
			}
		}
		return numCards;
	};
	
	// Gets a list of the card types in this card list.
	CardList.prototype.toTypeList = function() {
		let cards = [];
		let children = this.element.children;
		for (let container of children) {
			let item = container.firstChild;
			if (item.animated instanceof Card)
				cards.push(item.animated.type);
		}
		return cards;
	};

	// removes and returns all cards from the given element.
	function takeAllCards(element) {
		Motion.Animated.pinAll(element);

		// Get all cards
		let res = [];
		for (let container of element.children) {
			let item = container.firstChild;
			if (item.animated instanceof Card) {
				res.push(item.animated);
			} else if (item.holeFor instanceof Card) {
				item.holeFor.cancelDrag();
				res.push(item.holeFor);
			}
		}

		// Remove all items
		while (element.lastChild) element.removeChild(element.lastChild);
		return res;
	}

	// Removes and returns all cards in this card list.
	CardList.prototype.takeAllCards = function() {
		return takeAllCards(this.element);
	};
	
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
	function Deck(element, style) {
		this.element = element;
		this.style = style;
		this.numCards = 0;
		
		this.dummyContainer = document.createElement("div");
		this.dummyContainer.className = "container";
		this.element.appendChild(this.dummyContainer);
		this.mainContainer = null;
	}

	// Identifies the appearance of a deck.
	Deck.Style = {
		FaceDown: 0,
		FaceUp: 1,
		Invisible: 2
	};

	// Creates a card back animated element.
	Deck.createCardBack = function() {
		let element = document.createElement("div");
		element.className = "card-back";
		return new Motion.Animated(element);
	};

	// Sets the number of cards in this deck
	Deck.prototype.setSize = function(numCards) {
		if (numCards !== this.numCards) {
			this.numCards = numCards;
			if (this.style === Deck.Style.FaceDown) {
				if (numCards > 0) {

					// Create a card back if one does not yet exist
					if (!this.mainContainer) {
						this.mainContainer = document.createElement("div");
						this.mainContainer.className = "container";
						let element = document.createElement("div");
						element.className = "card-back";
						let counter = document.createElement("div");
						counter.className = "counter";
						counter.innerText = numCards;
						element.appendChild(counter);
						this.mainContainer.appendChild(element);
						this.element.appendChild(this.mainContainer);
					} else {
						this.mainContainer.firstChild.firstChild.innerText = numCards;
						trigger(this.mainContainer.firstChild.firstChild, "-pulse");
					}
				} else {
					if (this.mainContainer) {
						this.mainContainer.parentNode.removeChild(this.mainContainer);
					}
				}
			}
		}
	};

	// Pulls a card of the given type from this deck. The card should be immediately inserted into a
	// valid acceptor.
	Deck.prototype.pullCard = function(cardType) {
		let card = cardType ? Card.create(cardType) : Deck.createCardBack();
		this.dummyContainer.appendChild(card.element);
		card.pin();
		this.dummyContainer.removeChild(card.element);
		return card;
	};

	// Puts a card into this deck.
	Deck.prototype.putCard = function(card) {
		let container = document.createElement("div");
		container.className = "container";
		container.appendChild(card.element);
		this.element.appendChild(container);
		if (this.style === Deck.Style.Invisible) {
			card.element.className += " -fade-out";
			card.onSettle = function() {
				container.parentNode.removeChild(container);
			};
		} else {
			let dummyContainer = this.dummyContainer;
			card.onSettle = (function() {
				if (this.mainContainer) {
					this.mainContainer.parentNode.removeChild(this.mainContainer);
				}

				// Replace with static element
				let element = card.type.createElement();
				container.replaceChild(element, card.element);
				element.className += " -static";
				this.mainContainer = container;
			}).bind(this);
		}
	};
	
	// Augments an element to be the game constitution.
	function Constitution(list) {
		Motion.Acceptor.call(this, list);
		this.insertPoint = null;
		this.active = null;
	}
	
	Constitution.prototype = Object.create(Motion.Acceptor.prototype);
	
	// Creates an entry for a constitution.
	Constitution.createEntry = function(amend) {
		let list = createMiniList(amend.exp.toList());
		let element = document.createElement("div");
		element.className = "constitution-entry";
		if (amend.isProposal) element.className += " -proposal";
		element.appendChild(list);
		amend.entry = new Motion.Animated(element);
		amend.entry.amend = amend;
		return amend.entry;
	};

	// Creates an entry container for a constitution
	Constitution.createContainer = function(content) {
		let number = document.createElement("div");
		number.className = "number";
		let container = document.createElement("div");
		container.className = "constitution-entry-container";
		container.appendChild(number);
		if (content) container.appendChild(content);
		return container;
	};

	Constitution.prototype.dragGrab = function(element) {
		let entry = Motion.Animated.get(element);
		if (entry !== null && this.insertPoint === entry) {
			entry.pin();
			let hole = entry.element.parentNode;
			if (!(hole && hole.animated instanceof Motion.Animated)) {
				hole = document.createElement("div");
				hole.className = "constitution-entry -hole";
				new Motion.Animated(hole);
				entry.element.parentNode.replaceChild(hole, entry.element);
			}
			entry.hole = hole;
			return entry;
		}
		return null;
	};

	Constitution.prototype.dragRelease = function(animated) {
		animated.settleInto(animated.hole);
		animated.hole = null;
	};

	Constitution.prototype.dragEnterMove = function(animated, left, top, fromAcceptor) {

		// Only allow incoming from the same acceptor
		if (fromAcceptor === this) {
			let cur = null;
			let bestDis = Infinity;
			for (let container of this.element.children) {
				let item = container.lastChild;
				let midY = container.offsetTop + container.offsetHeight / 2.0;
				let dis = Math.abs(midY - top);
				if (dis < bestDis) {
					cur = item;
					bestDis = dis;
				}
			}

			if (cur === animated.hole) return true;

			// Re-insert hole container at the correct place without shuffling around any other containers.
			Motion.Animated.pinAll(this.element);
			let afterHole = false;
			for (let container of this.element.children) {
				if (animated.hole.parentNode === container) {
					afterHole = true;
				} else if (cur.parentNode === container) {
					if (afterHole) {
						this.element.insertBefore(animated.hole.parentNode, container.nextSibling);
					} else {
						this.element.insertBefore(animated.hole.parentNode, container);
					}
					break;
				}
			}
			this.renumber();
			return true;
		}
		return false;
	};

	// Updates the numbering of the entries in this constitution.
	Constitution.prototype.renumber = function() {
		let children = this.element.children;
		for (let i = 0; i < children.length; i++) {
			children[i].firstChild.innerText = (i + 1).toString();
		}
	};
	
	// Populates a constitution from the given list
	Constitution.prototype.populate = function(constitution) {
		Motion.Animated.pinAll(this.element);
		for (let i = 0; i < constitution.length; i++) {
			let entry = Constitution.createEntry(constitution[i]);
			this.element.appendChild(Constitution.createContainer(entry.element));
		}
		this.renumber();
	};

	// Inserts an amendment into the constutition.
	Constitution.prototype.insertAmend = function(line, amend) {
		Motion.Animated.pinAll(this.element);
		let entry = Constitution.createEntry(amend);
		let container = Constitution.createContainer(entry.element);
		this.element.insertBefore(container, this.element.children[line] || null);
		this.renumber();
	};
	
	// Removes an amendment from the constitution.
	Constitution.prototype.removeAmend = function(amend) {
		Motion.Animated.pinAll(this.element);
		this.element.removeChild(amend.entry.element.parentNode);
		this.renumber();
	};

	// Sets the amendment that is marked as being active.
	Constitution.prototype.setActive = function(amend) {
		if (this.active) {
			let element = this.active.entry.element;
			element.className = element.className.replace(" -active", "");
		}
		amend.entry.element.className += " -active";
		this.active = amend;
	};

	// Updates the proposal status of the given amendment.
	Constitution.prototype.updateAmend = function(amend) {
		if (this.active !== amend) {
			let element = amend.entry.element;
			element.className = element.className.replace(" -proposal", "");
			if (amend.isProposal) {
				element.className += " -proposal";
			}
		}
	};

	// Creates a placeholder entry that allows the user to pick an insertion point in the constitution.
	Constitution.prototype.allowInsertPick = function() {
		if (!this.insertPoint) {
			Motion.Animated.pinAll(this.element);
			let element = document.createElement("div");
			element.className = "constitution-entry -insert-point";
			element.innerText = "Insert amendment here";
			this.insertPoint = new Motion.Animated(element);
			this.insertPoint.hoverStyle = "-hover";
			this.element.appendChild(Constitution.createContainer(element));
			this.renumber();
		}
	};

	// Removes the insert placeholder from the constitution.
	Constitution.prototype.cancelInsertPick = function() {
		if (this.insertPoint) {
			Motion.Animated.pinAll(this.element);
			this.element.removeChild(this.insertPoint.element.parentNode);
			this.renumber();
			this.insertPoint = null;
		}
	};

	// Replaces the insert placeholder with the given amendment.
	Constitution.prototype.insertPickAmend = function(amend) {
		console.assert(this.insertPoint);
		Motion.Animated.pinAll(this.element);
		let entry = Constitution.createEntry(amend);
		this.insertPoint.element.parentNode.replaceChild(entry.element, this.insertPoint.element);
		this.insertPoint = null;
	};

	// Gets the line that the insert placeholder is on, or null if it doesn't exist.
	Constitution.prototype.getInsertLine = function() {
		if (this.insertPoint) {
			for (let i = 0; i < this.element.children.length; i++) {
				let child = this.element.children[i];
				if (child === this.insertPoint.element.parentNode ||
					child === this.insertPoint.hole)
					return i;
			}
		}
		return null;
	};
	
	// Augments an element to be a game log.
	function Log(element) {
		this.element = element;
		this.lastDepth = 0;
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
		this.lastDepth = depth;
		this.scrollToBottom();
	};

	// Appends a chat message to the log.
	Log.prototype.chat = function(user, message) {
		if (user) {
			this.log(this.lastDepth, [user, ": ", message], Log.Style.Chat);
		} else {
			this.log(this.lastDepth, [message], Log.Style.Chat);
		}
	};
	
	// Scrolls to the bottom of the log.
	Log.prototype.scrollToBottom = function() {
		this.element.scrollTop = this.element.scrollHeight;
	};
	
	// Augments an element to be a button.
	function Button(element, isVisible) {
		this.element = element;
		element.button = this;
		this.isEnabled = true;
		this.isVisible = isVisible === false ? false : true;
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

	// Sets whether this button is visible.
	Button.prototype.setVisible = function(visible) {
		if (this.isVisible !== visible) {
			this.isVisible = visible;
			if (visible) {
				this.element.style.display = "";
			} else {
				this.element.style.display = "none";
			}
		}
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
	};
	
	// Handles a button click.
	Button.prototype.onClick = function() {
		// Override me
	}
	
	
	// Augments a set of elements to display player information.
	function PlayerInfo(player, element, coins, cards) {
		this.element = element;
		this.coins = coins;
		this.cards = cards;
		
		coins.innerText = player.coins;
		cards.innerText = player.handSize;
	}
	
	// Creates a player info section for a non-self player.
	PlayerInfo.create = function(player, isLeft) {
		let container = document.createElement("div");
		
		if (isLeft) {
			container.className = "section-player-left";
		} else {
			container.className = "section-player-right";
		}
		
		let name = document.createElement("div");
		name.className = "player-name";
		name.innerText = player.name;
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
		
		let playerInfo = new PlayerInfo(player, container, coins, cards);
		playerInfo.container = container;
		return playerInfo;
	};
	
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
	};
	
	// Sets the number of cards the given player has.
	PlayerInfo.prototype.setCards = function(cards) {
		this.cards.innerText = cards;
		trigger(this.cards, "-pulse");
	};

	// Sets whether this is the current turn's player.
	PlayerInfo.prototype.setIsTurnPlayer = function(isTurnPlayer) {
		this.element.className = this.element.className.replace(" -turn-player", "");
		if (isTurnPlayer) {
			this.element.className += " -turn-player";
		}
	};
	
	// The base class for input interfaces.
	function Input(container) {
		this.container = container;
		this.callback = null;
	}
	
	// Called when a response to an input request is given.
	Input.prototype.respond = function() {
		if (this.callback) this.callback.apply(null, arguments);
		this.callback = null;
		this.container.parentNode.style.height = "";
	}
	
	// Shows this input interface, requesting a response from the user.
	Input.prototype.request = function(callback) {
		let section = this.container.parentNode;
		section.insertBefore(this.container, section.firstChild);
		section.style.height = this.container.offsetHeight + "px";
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
			Input.prototype.request.call(this, callback);
			this.set(Math.min(this.coins, this.limit));
		};
		
		// Augments a set of elements to be a cards input.
		function Cards(container, list, buttons) {
			Input.call(this, container);
			this.cardList = new CardList(list);
			this.buttons = buttons;
			this.returnTarget = null;
			this.amount = null;

			let cards = this;

			// Don't accept extra cards, or cards of the wrong type.
			let oldDragEnterMove = this.cardList.dragEnterMove;
			this.cardList.dragEnterMove = function(animated, left, top, fromAcceptor) {
				if (fromAcceptor === this ||
					!cards.amount ||
					this.getNumCards() < cards.amount.max())
				{
					if (oldDragEnterMove.call(this, animated, left, top, fromAcceptor)) {
						
						// Enable if there are enough cards
						cards.updateButtons();
						return true;
					}
				}
				return false;
			};
			
			// Disable on leave
			let oldDragLeave = this.cardList.dragLeave;
			this.cardList.dragLeave = function(card) {
				oldDragLeave.call(this, card);
				cards.updateButtons();
			};
		};
		
		// Updates the status of the buttons in this input
		Cards.prototype.updateButtons = function() {
			let numCards = this.cardList.getNumCards();
			setButtonsEnabled(this.buttons, numCards > 0 && (!this.amount || this.amount.contains(numCards)));
		};
		
		Cards.prototype.onButtonClick = function(options) {
			if (options.pass) {
				for (let card of this.cardList.takeAllCards()) {
					this.returnTarget.putCard(card);
				}
				this.respond(null, options.value);
			} else {
				let cards = this.cardList.toTypeList();
				if (cards.length > 0 && (!this.amount || this.amount.contains(cards.length))) {
					this.respond(cards, options.value);
				}
			}
		};
		
		// Removes and returns all cards currently in this card list.
		Cards.prototype.takeAllCards = function() {
			return this.cardList.takeAllCards();
		};
		
		Cards.prototype.respond = Input.prototype.respond;
		Cards.prototype.request = function(options, callback) {
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

		Expression.prototype.dragGrab = function(element) {
			let card = Motion.Animated.get(element);
			if (card instanceof Card) {
				card.pin();

				if (card.element.parentNode.holeFor === card) {
					card.hole = card.element.parentNode;
					return card;
				} else {
					let hole = Expression.createSlotHole(element.animated.type.role, true);
					hole.holeFor = element.animated;
					card.element.parentNode.replaceChild(hole, card.element);
					card.hole = hole;
					return card;
				}
			}
			return null;
		};

		Expression.prototype.dragRelease = function(animated) {
			animated.settleInto(animated.hole);
			animated.hole = null;
		};

		Expression.prototype.dragEnterMove = function(card, left, top, fromAcceptor) {

			// Don't allow incoming cards from the same expression
			if (fromAcceptor !== this && card instanceof Card) {
				let role = card.type.role;
				let cur = null;
				let bestDis = Infinity;
				for (let container of this.element.children) {
					let item = container.firstChild;
					let rect = Motion.getTargetRect(this.element, item);
					let midX = rect.left + rect.width / 2.0;
					let dis = Math.abs(midX - left);
					if (dis < bestDis && (item.holeFor === card || item.holeFor === role)) {
						cur = item;
						bestDis = dis;
					}
				}

				if (cur) {
					if (cur.holeFor === card) {
						return true;
					} else if (cur.holeFor === role) {
						fromAcceptor.dragLeave(card);
						card.hole = cur;
						cur.holeFor = card;
						cur.className = "card-hole-" + role.str.toLowerCase() + "-active";
						this.addSlots(cur, card.type.slots);
						this.updateButtons();
						return true;
					}
				}
			}
			return false;
		};
		
		Expression.prototype.dragLeave = function(card) {
			let hole = card.hole;
			hole.holeFor = card.type.role;
			hole.className = "card-hole-" + hole.holeFor.str.toLowerCase();
			this.removeSlots(hole, card.type.slots.length);
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
			this.addSlots(null, [role]);
		};
		
		// Adds slots to an expression after the given card element.
		Expression.prototype.addSlots = function(after, slots) {
			Motion.Animated.pinAll(this.element);
			let before = after ? after.parentNode.nextSibling : null;
			for (let i = 0; i < slots.length; i++) {
				let hole = Expression.createSlotHole(slots[i], false);
				let container = document.createElement("div");
				container.className = "card-container";
				container.appendChild(hole);
				this.list.insertBefore(container, before);
			}
		};
		
		// Removes a certain number slots from an expression after the given card element.
		Expression.prototype.removeSlots = function(after, count) {
			Motion.Animated.pinAll(this.element);
			for (let i = 0; i < count; i++) {
				let container = after.parentNode.nextSibling;
				let item = container.firstChild;
				if (item.animated instanceof Card) {
					this.returnTarget.putCard(item.animated);
					count += item.animated.type.slots.length;
				}
				this.list.removeChild(container);
			}
		};
		
		// Updates the status of the buttons in this input
		Expression.prototype.updateButtons = function() {
			// Check if all slots have been filled
			let allFilled = true;
			for (let container of this.list.children) {
				let item = container.firstChild;
				allFilled = allFilled && ((item.animated instanceof Card) || (item.holeFor instanceof Card));
			}
			setButtonsEnabled(this.buttons, allFilled);
		};

		// Removes and returns all cards from this expression, and resets it to its initial state.
		Expression.prototype.takeAllCards = function() {
			return takeAllCards(this.list);
		};
		
		Expression.prototype.onButtonClick = function(options) {
			if (options.pass) {
				for (let card of this.takeAllCards()) {
					this.returnTarget.putCard(card);
				}
				this.respond(null, options.value);
			} else {

				// Build expression
				let cards = [];
				let children = this.element.children;
				for (let i = 0; i < children.length; i++) {
					let container = children[i];
					let item = container.firstChild;
					if (item.animated) {
						cards.push(item.animated.type);
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