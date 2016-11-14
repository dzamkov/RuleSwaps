PATH := node_modules/.bin:$(PATH)
SHELL := /bin/bash

output_dir := dist
source_dir := source
int_dir := temp

all: $(output_dir)/static $(output_dir)/server.js

clean:
	rm -rf $(output_dir)/*
	rm -rf $(int_dir)/*

$(output_dir)/static: \
	$(output_dir)/static/images \
	$(output_dir)/static/index.html \
	$(output_dir)/static/style.css \
	$(output_dir)/static/script.js

$(output_dir)/static/images:
	mkdir -p $(dir $@)
	rsync -rupE $(source_dir)/static/images $(output_dir)/static/
	
$(output_dir)/%.html: $(source_dir)/%.html
	html-minifier $< --collapse-whitespace -o $@
	
$(output_dir)/%.css: $(source_dir)/%.scss
	node-sass $< --output-style compressed > $@

$(int_dir)/%.js: $(source_dir)/%.js
	mkdir -p $(dir $@)
	babel $< --presets es2015 -o $@
	
common_files := $(int_dir)/card.js $(int_dir)/cards.js 
client_files := $(common_files) $(int_dir)/motion.js $(int_dir)/ui.js $(int_dir)/client.js
server_files := $(common_files) $(int_dir)/server.js

$(output_dir)/static/script.js: node_modules/babel-polyfill/dist/polyfill.min.js $(client_files)
	uglifyjs node_modules/babel-polyfill/dist/polyfill.min.js $(client_files) --compress -o $@
	
$(output_dir)/server.js: node_modules/babel-polyfill/dist/polyfill.min.js $(server_files)
	uglifyjs node_modules/babel-polyfill/dist/polyfill.min.js $(server_files) --compress -o $@
	
run: all
	cd $(output_dir) && nodejs server.js 1888