// Populate cards
window.onload = function() {

	// Build card lists
	var cardlists = document.getElementsByClassName("card-list");
	for (let i = 0; i < cardlists.length; i++) {
		let cardlist = cardlists.item(i);
		let cards = cardlist.dataset.cards.split(" ");
		for (let card of cards) {
			let element = document.createElement("div");
			element.className = "card-space";
			element.appendChild(Card.get(card).createElement(false));
			cardlist.appendChild(element);
		}
	}

	// Build standard constitution
	var constitutions = document.getElementsByClassName("constitution");
	for (let i = 0; i < constitutions.length; i++) {
		let constitution = constitutions.item(i);
		for (let j = 0; j < defaultSetup.constitution.length; j++) {
			let amendment = document.createElement("div");
			amendment.className = "amendment";
			let number = document.createElement("div");
			number.className = "number";
			number.innerText = getOrdinal(j + 1) + " Amendment";
			amendment.appendChild(number);
			let cards = defaultSetup.constitution[j].toList();
			for (let card of cards) {
				let element = document.createElement("div");
				element.className = "card-space";
				element.appendChild(Card.get(card).createElement(false));
				amendment.appendChild(element);
			}
			constitution.appendChild(amendment);
		}
	}

	// Add cards to decklist
	let container = document.getElementById("section-rulebook-decklist");
	for (let card in defaultDeck.counts) {
		let count = defaultDeck.counts[card];
		let element = document.createElement("div");
		element.className = "card-space";
		element.appendChild(Card.get(card).createElement(false));
		if (count > 1) {
			let countSpan = document.createElement("span");
			countSpan.className = "card-count";
			countSpan.innerText = "x" + count;
			element.appendChild(countSpan);
		}
		container.appendChild(element);
	}
}