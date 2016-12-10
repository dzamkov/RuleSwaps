// Contains functions related to cookies
let Cookie = new function() {
	
	// Builds a cookie string with the given content given as a key/value map.
	this.build = function(content) {
		let str = "";
		for (let key in content) {
			str += key + "=" + content[key] + ";"
		}
		return str;
	};

	// Builds a cookie string with the given content. Sets the cookie to not expire and to be applicable
	// across the site.
	this.buildPersistent = function(content) {
		let exdate = new Date();
		exdate.setDate(exdate.getDate() + 100 * 365);
		content["expires"] = exdate.toUTCString();
		content["path"] = "/";
		return this.build(content);
	};

	// Parses the contents of a cookie string.
	this.parse = function(str) {
		let res = { };
		let pair = str.split(";");
		for (let i = 0; i < pair.length; i++) {
			let parts = pair[i].replace(";","").split("=");
			res[parts[0]] = parts[1];
		}
		return res;
	};

};