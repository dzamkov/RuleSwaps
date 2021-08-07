// Populate cards
window.onload = function() {
	let container = document.getElementById("section-decklist-list");
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