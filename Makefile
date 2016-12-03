MAKEFLAGS += -r

PATH := node_modules/.bin:$(PATH)
SHELL := /bin/bash

output_dir := output
source_dir := source
int_dir := $(output_dir)/temp

common_files := \
	card.js \
	game.js \
	cards.js \
	format.js
client_files := $(common_files) \
	client/motion.js \
	client/ui.js \
	client/interface.js \
	client.js
server_files := $(common_files) server.js
	
$(output_dir)/dist: $(output_dir)/dist/static $(output_dir)/dist/server.js

$(output_dir)/dist/static: \
	$(output_dir)/dist/static/images \
	$(output_dir)/dist/static/game.html \
	$(output_dir)/dist/static/style.css \
	$(output_dir)/dist/static/script.js
	
$(output_dir)/debug: $(output_dir)/debug/static $(output_dir)/debug/server.js

$(output_dir)/debug/static: \
	$(output_dir)/debug/static/images \
	$(output_dir)/debug/static/game.html \
	$(output_dir)/debug/static/style.css \
	$(output_dir)/debug/static/script.js \
	$(output_dir)/debug/static/scripts
	
$(output_dir)/%/static/images: $(source_dir)/static/images/*
	mkdir -p $(dir $@)
	rsync -rupE $(source_dir)/static/images $(@D)

$(int_dir)/%.js: $(source_dir)/%.js
	mkdir -p $(dir $@)
	babel $< --presets es2015 -o $@
	
$(output_dir)/dist/static/script.js: node_modules/babel-polyfill/dist/polyfill.min.js $(addprefix $(int_dir)/,$(client_files))
	mkdir -p $(dir $@)
	uglifyjs $^ --compress -o $@
	
$(output_dir)/dist/server.js: node_modules/babel-polyfill/dist/polyfill.min.js $(addprefix $(int_dir)/,$(server_files))
	mkdir -p $(dir $@)
	uglifyjs $^ --compress -o $@
	
$(output_dir)/dist/static/style.css: $(source_dir)/style/*
	mkdir -p $(dir $@)
	node-sass $(source_dir)/style/game.scss --output-style compressed > $@

$(output_dir)/dist/%.html: $(source_dir)/%.html
	mkdir -p $(dir $@)
	html-minifier $< --collapse-whitespace -o $@
	
$(output_dir)/debug/static/style.css: $(source_dir)/style/*
	mkdir -p $(dir $@)
	node-sass $(source_dir)/style/game.scss > $@

$(output_dir)/debug/%.html: $(source_dir)/%.html
	mkdir -p $(dir $@)
	cp $< $@

$(output_dir)/debug/static/script.js:
	mkdir -p $(dir $@)
	> $@; \
	for file in $(client_files); do \
		echo "document.write('<script type=\"text/javascript\" src=\"/static/scripts/"$$file"\"></script>');" >> $@; \
	done

$(output_dir)/debug/static/scripts: $(addprefix $(source_dir)/,$(client_files))
	mkdir -p $@
	mkdir -p $@/client
	for file in $(client_files); do \
		cp $(source_dir)/$$file $@/$$file; \
	done

$(output_dir)/debug/scripts: $(addprefix $(source_dir)/,$(server_files))
	mkdir -p $@
	for file in $(server_files); do \
		cp $(source_dir)/$$file $@/$$file; \
	done

$(output_dir)/debug/server.js: $(addprefix $(source_dir)/,$(server_files))
	mkdir -p $(dir $@)
	echo "\"use strict\";" > $@; \
	cat $^ >> $@
	
clean:
	rm -rf $(output_dir)/*
	rm -rf $(int_dir)/*
	
check_syntax: \
	$(addprefix $(int_dir)/,$(client_files)) \
	$(addprefix $(int_dir)/,$(server_files))
	
run: $(output_dir)/dist
	cd $(output_dir)/dist && nodejs server.js 1888

debug: $(output_dir)/debug check_syntax
	cd $(output_dir)/debug && nodejs server.js 1888