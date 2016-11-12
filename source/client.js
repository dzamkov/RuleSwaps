window.onload = function() {
	for (var key in Cards) {
		document.body.appendChild(Cards[key].createElement());	
	}
}