
window.onload = function() {
	function addCard(name) {
		var element = Cards[name].createElement();
		document.body.appendChild(element);
		Motion.enableDrag(element, function() {
			var hole = document.createElement("div");
			hole.isHole = true;
			hole.className = "card-exit-hole";
			return hole;
		});
		Motion.styleOnHover(element, "card-hover");
	}
	addCard("perform_action_required");
	addCard("wealth-vote");
	addCard("payment");
	addCard("wealthiest_player");
	
	function balanceChildren() {
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
	
	Motion.enableAccept(document.getElementById("section-player-hand"), function(element, left, top) {
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
		if (prev && prev.isHole) return prev;
		if (next && next.isHole) return next;
		
		var hole = document.createElement("div");
		hole.isHole = true;
		hole.className = "card-exit-hole";
		this.insertBefore(hole, next);
		balanceChildren.call(this);
		return hole;
	}, function(hole) {
		this.removeChild(hole);
		balanceChildren.call(this);
	});
} 