var http = require("http");
var url = require("url");
var path = require("path");
var fs = require("fs");
var mime = require("mime");

var port = parseInt(process.argv[2], 10);

http.createServer(function(request, response) {
	var uri = path.resolve(url.parse(request.url).pathname);
	if (uri == "/") uri = "index.html";
	var filename = path.join(process.cwd(), "static", uri);
	fs.readFile(filename, "binary", function(err, file) {
		if (err) {
			response.writeHead(404, {"Content-Type": "text/plain"});
			response.write("404 Not Found. \n");
			response.end();
		} else {
			response.writeHead(200, { "Content-Type": mime.lookup(filename) });
			response.write(file, "binary");
			response.end();
		}
	});
}).listen(port);

console.log("Server running...");