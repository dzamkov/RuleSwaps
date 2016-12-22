// Contains functions related to animated elements and dragging.
var Motion = new function() {

	// Assuming the given element is a descendant of the given container element, gets the direct child
	// of the container that contains that element.
	function getImmediateChild(container, element) {
		while (element && element.parentNode !== container) {
			element = element.parentNode;
		}
		return element;
	}
	
	// Gets the rectangle describing the target positioning of the given element relative to the given
	// container. This is most useful for implementing Animated.dragEnterMove.
	function getTargetRect(container, element) {
		let stopParent = container.offsetParent;
		let left = container.scrollLeft - container.offsetLeft;
		let top = container.scrollTop - container.offsetTop;
		let cur = element;
		while (cur !== stopParent) {
			console.assert(cur);
			left += cur.offsetLeft;
			top += cur.offsetTop;
			cur = cur.offsetParent;
		}
		if (element.animated instanceof Animated) {
			left -= element.animated.x;
			top -= element.animated.y;
		}
		return {
			left: left,
			top: top,
			width: element.offsetWidth,
			height: element.offsetHeight
		};
	}

	// Augments an element with the ability to smoothly move across the DOM and possibly be dragged.
	function Animated(element) {
		this.element = element;
		this.hoverStyle = null;
		this.pinRect = null;
		this.isFree = false;
		this.isMouseOver = false;
		this.isMouseHover = false;
		this.x = 0; this.velX = 0;
		this.y = 0; this.velY = 0;
		this.updateCallback = this.update.bind(this);
		this.lastTimeStamp = null;

		this.acceleration = 500.0;
		this.damping = Math.sqrt(4.0 * this.acceleration);

		element.animated = this;
		element.addEventListener("mouseenter", this.setMouseOver.bind(this, true));
		element.addEventListener("mouseleave", this.setMouseOver.bind(this, false));
	};

	// Pins all animated descendants of the given element.
	Animated.pinAll = function(element) {
		for (let child of element.children) {
			if (child.animated instanceof Animated) {
				child.animated.pin();
			} else {
				Animated.pinAll(child);
			}
		}
	};

	// Gets the animated interface containing the given element, or null.
	Animated.get = function(element) {
		let animated = null;
		while (element && !((animated = element.animated) instanceof Animated))
			element = element.parentNode;
		return animated || null;
	};
	
	// The set of animated elements that were pinned but not updated.
	Animated.toFlush = [];

	// Updates animated elements that were pinned and moved within the DOM.
	Animated.flush = function() {
		for (let animated of Animated.toFlush) {
			if (!animated.isFree) {

				// Find difference between current position and pin position
				let curRect = animated.element.getBoundingClientRect();
				animated.x += animated.pinRect.left - curRect.left;
				animated.y += animated.pinRect.top - curRect.top;

				// Animate if needed
				if (animated.x || animated.y) {
					animated.element.style.position = "relative";
					animated.moveTo(animated.x, animated.y);
					window.requestAnimationFrame(animated.updateCallback);
				}
			}
			animated.pinRect = null;
		}
		Animated.toFlush = [];
	};

	// Fixes this animated element to its current viewport position prior to its surronding layout
	// being changed. This allows the element to transition to another target position without
	// appearing discontinuous.
	Animated.prototype.pin = function() {
		if (!this.pinRect) {
			this.pinRect = this.element.getBoundingClientRect();
			Animated.toFlush.push(this);
		}
	};

	// Sets the position of an element.
	Animated.prototype.moveTo = function(x, y) {
		let element = this.element;
		element.style.left = x + "px";
		element.style.top = y + "px";
		this.x = x;
		this.y = y;
	};

	// Causes this animated element to become freely positioned.
	Animated.prototype.dislodge = function() {
		if (!this.isFree) {
			let element = this.element;
			let rect = this.pinRect;
			element.style.position = "fixed";
			element.style.left = rect.left + "px";
			element.style.top = rect.top + "px";
			element.style.width = rect.width + "px";
			element.style.height = rect.height + "px";
			this.x = rect.left; this.velX = 0;
			this.y = rect.top; this.velY = 0;
			document.body.appendChild(element);
			this.isFree = true;
		}
	};

	// Causes this animated element to smoothly move to its expected position in the DOM.
	Animated.prototype.settle = function() {
		if (this.isFree) {
			let element = this.element;
			element.style.position = "relative";
			element.style.left = "0";
			element.style.top = "0";
			element.style.width = "";
			element.style.height = "";
			this.x = 0;
			this.y = 0;
			this.lastTimeStamp = null;
			this.isFree = false;
		}
	};

	// Causes this animated element to smoothly take the place of the given placeholder element.
	Animated.prototype.settleInto = function(hole) {
		hole.parentNode.replaceChild(this.element, hole);
		this.settle();
	};

	// Indicates that the animated element has stopped moving.
	Animated.prototype.onSettle = function() {
		// Override me
	};

	// Handles a frame update for the animation for this animated element.
	Animated.prototype.update = function(timeStamp) {
		if (!this.isFree) {
			if (this.x * this.x + this.y * this.y > 1.0) {
				if (!this.lastTimeStamp) this.lastTimeStamp = timeStamp;
				let delta = Math.min((timeStamp - this.lastTimeStamp) / 1000.0, 0.1);
				this.lastTimeStamp = timeStamp;

				this.velX += (-this.x * this.acceleration - this.velX * this.damping) * delta;
				this.velY += (-this.y * this.acceleration - this.velY * this.damping) * delta;
				this.moveTo(this.x + this.velX * delta, this.y + this.velY * delta);
				window.requestAnimationFrame(this.updateCallback);
			} else {
				let element = this.element;
				element.style.left = "0";
				element.style.top = "0";
				this.x = 0; this.velX = 0;
				this.y = 0; this.velY = 0;
				this.lastTimeStamp = null;
				this.onSettle();
			}
		}
	};

	// If this animated element is being dragged, stops dragging and removes it from the DOM.
	Animated.prototype.cancelDrag = function() {
		if (window.dragging && window.dragging.animated === this) {
			window.dragging = null;
			document.body.removeChild(this.element);
			this.settle();
			return true;
		}
		return false;
	};

	// Removes this animated element from the DOM and stops it from being dragged.
	Animated.prototype.delete = function() {
		if (!this.cancelDrag() && this.element.parentNode)
			this.element.parentNode.removeChild(this.element);
	};

	// Sets whether the mouse is over this element (which doesn't necessarily correlate hovering, since
	// dragged elements will always be hovered over and in that case no other element can be).
	Animated.prototype.setMouseOver = function(isMouseOver) {
		this.isMouseOver = isMouseOver;
		this.updateMouseHover();
	};

	// Updates the mouse hover status of this animated element.
	Animated.prototype.updateMouseHover = function() {
		let isMouseHover = window.dragging ? window.dragging.animated === this : this.isMouseOver;
		if (isMouseHover !== this.isMouseHover) {
			if (isMouseHover) {
				this.element.className += " " + this.hoverStyle;
			} else {
				this.element.className = this.element.className.replace(" " + this.hoverStyle, "");
			}
			this.isMouseHover = isMouseHover;
		}
	};

	// Sets whether the mouse is hovering over this element.
	Animated.prototype.setMouseHover = function(isMouseHover) {
		if (this.isMouseHover !== isMouseHover) {
			if (isMouseHover) {
				this.element.className += " " + this.hoverStyle;
			} else {
				this.element.className = this.element.className.replace(" " + this.element.hoverStyle, "");
			}
		}
	};

	// Augments an element with the ability to accept animated elements dragged into it and have
	// its own animated children dragged out.
	function Acceptor(element) {
		this.element = element;
		element.acceptor = this;

		let acceptor = this;
		element.addEventListener("mousedown", function(e) {
			if (e.button === 0 && !window.dragging) {
				e.preventDefault();
				let animated = acceptor.dragGrab(e.target);
				if (animated) {
					animated.dislodge();
					let rect = animated.pinRect;
					animated.lastTimeStamp = performance.now();
					window.dragging = {
						animated: animated,
						acceptor: acceptor,
						offsetX: e.clientX - rect.left,
						offsetY: e.clientY - rect.top,
					};
					animated.updateMouseHover();
				}
				Animated.flush();
			}
		});
	}

	// Indicates that the user is attempting to drag an element in this acceptor. If successful, returns
	// the animated element that was grabbed.
	Acceptor.prototype.dragGrab = function(element) {
		return null;
	};

	// Indicates that the user has stopped dragging the given animated element while it is owned by
	// this acceptor.
	Acceptor.prototype.dragRelease = function(animated) {

	};

	// Indicates that the user is attempting to drag an animated element into or within this acceptor. If
	// successful, this will return true and the animated element will be owned by this acceptor. Otherwise,
	// this will return false.
	Acceptor.prototype.dragEnterMove = function(animated, left, top, fromAcceptor) {
		return false;
	};

	// Handle mouse move for dragging
	window.addEventListener("mousemove", function(e) {
		let dragging = window.dragging;
		if (dragging) {
			let animated = dragging.animated;
			if (animated) {
				e.preventDefault();

				// Update velocity (for inertia) and position
				let ox = animated.x;
				let oy = animated.y;
				animated.moveTo(e.clientX - dragging.offsetX, e.clientY - dragging.offsetY);


				let nTimeStamp = performance.now();
				let delta = (nTimeStamp - animated.lastTimeStamp) / 1000.0;
				animated.lastTimeStamp = nTimeStamp;
				animated.velX = (animated.x - ox) / delta;
				animated.velY = (animated.y - oy) / delta;

				// Check behind dragged element for possible acceptor
				let element = animated.element;
				element.style.visibility = "hidden";
				let acceptorElement = document.elementFromPoint(e.clientX, e.clientY);
				element.style.visibility = "visible";

				// Traverse hiearchy for acceptor.
				let acceptor;
				while (acceptorElement && !(acceptor = acceptorElement.acceptor))
					acceptorElement = acceptorElement.parentNode;

				// Try to introduce into acceptor
				if (acceptor) {
					let rect = acceptorElement.getBoundingClientRect();
					let left = e.clientX - rect.left + acceptorElement.scrollLeft;
					let top = e.clientY - rect.top + acceptorElement.scrollTop;
					let hole = animated.hole;
					if (acceptor.dragEnterMove(animated, left, top, dragging.acceptor)) {
						dragging.acceptor = acceptor;
					}
				}

			} else if (dragging.move) {
				dragging.move.call(dragging, e);
			}
			Animated.flush();
		}
	});

	// Handle mouse up for dragging
	window.addEventListener("mouseup", function windowMouseUp(e) {
		var dragging = window.dragging;
		if (e.button === 0 && dragging) {
			e.preventDefault();
			window.dragging = null;
			if (dragging.animated) {
				dragging.animated.pin();
				dragging.acceptor.dragRelease(dragging.animated);
				dragging.animated.updateMouseHover();
				Animated.flush();
			}
		}
	});

	this.getImmediateChild = getImmediateChild;
	this.getTargetRect = getTargetRect;
	this.Animated = Animated;
	this.Acceptor = Acceptor;
}