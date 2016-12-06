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
client_common_files := $(common_files) \
	client/motion.js \
	client/ui.js \
	client/interface.js \
	client/net.js
server_files := $(common_files) \
	server/user.js \
	server/game.js \
	server/lobby.js \
	server.js

pages := \
	game \
	lobby

$(output_dir)/dist: $(output_dir)/dist/static $(output_dir)/dist/server.js

$(output_dir)/dist/static: \
	$(output_dir)/dist/static/images \
	$(output_dir)/dist/static/common.js \
	$(addprefix $(output_dir)/dist/static/, \
		$(addsuffix .html,$(pages)) \
		$(addsuffix .css,$(pages)) \
		$(addsuffix .js,$(pages)))
	
$(output_dir)/debug: $(output_dir)/debug/static $(output_dir)/debug/server.js $(output_dir)/debug/fuzzer.js

$(output_dir)/debug/static: \
	$(output_dir)/debug/static/images \
	$(output_dir)/debug/static/common.js \
	$(output_dir)/debug/static/scripts \
	$(addprefix $(output_dir)/debug/static/, \
		$(addsuffix .html,$(pages)) \
		$(addsuffix .css,$(pages)) \
		$(addsuffix .js,$(pages)))
	
$(output_dir)/%/static/images: $(source_dir)/static/images/*
	mkdir -p $(dir $@)
	rsync -rupE $(source_dir)/static/images $(@D)

$(int_dir)/%.js: $(source_dir)/%.js
	mkdir -p $(dir $@)
	babel $< --presets es2015 -o $@
	
$(output_dir)/dist/static/%.js: $(int_dir)/client/%.js
	mkdir -p $(dir $@)
	uglifyjs $^ --compress -o $@
	
$(output_dir)/dist/static/common.js: node_modules/babel-polyfill/dist/polyfill.min.js $(addprefix $(int_dir)/,$(client_common_files))
	mkdir -p $(dir $@)
	uglifyjs $^ --compress -o $@
	
$(output_dir)/dist/server.js: node_modules/babel-polyfill/dist/polyfill.min.js $(addprefix $(int_dir)/,$(server_files))
	mkdir -p $(dir $@)
	uglifyjs $^ --compress -o $@
	
$(output_dir)/dist/static/%.css: $(source_dir)/style/*
	mkdir -p $(dir $@)
	node-sass $(source_dir)/style/$(*F).scss --output-style compressed > $@

$(output_dir)/dist/static/%.html: $(source_dir)/static/%.html
	mkdir -p $(dir $@)
	html-minifier $< --collapse-whitespace -o $@
	
$(output_dir)/debug/static/%.css: $(source_dir)/style/*
	mkdir -p $(dir $@)
	node-sass $(source_dir)/style/$(*F).scss > $@

$(output_dir)/debug/static/%.html: $(source_dir)/static/%.html
	mkdir -p $(dir $@)
	cp $< $@
	
$(output_dir)/debug/static/%.js: $(source_dir)/client/%.js
	mkdir -p $(dir $@)
	cp $< $@

$(output_dir)/debug/static/common.js:
	mkdir -p $(dir $@)
	> $@; \
	for file in $(client_common_files); do \
		echo "document.write('<script type=\"text/javascript\" src=\"/static/scripts/"$$file"\"></script>');" >> $@; \
	done

$(output_dir)/debug/static/scripts: $(addprefix $(source_dir)/,$(client_common_files))
	mkdir -p $@
	mkdir -p $@/client
	for file in $(client_common_files); do \
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
	
$(output_dir)/debug/fuzzer.js: $(addprefix $(source_dir)/,$(common_files)) $(source_dir)/fuzzer.js
	mkdir -p $(dir $@)
	echo "\"use strict\";" > $@; \
	cat $^ >> $@
	
clean:
	rm -rf $(output_dir)/*
	rm -rf $(int_dir)/*
	
run: $(output_dir)/dist
	cd $(output_dir)/dist && nodejs server.js 1888

debug: $(output_dir)/debug
	cd $(output_dir)/debug && nodejs --check server.js && nodejs server.js 1888

fuzz: $(output_dir)/debug
	cd $(output_dir)/debug && (nodejs fuzzer.js > fuzzlog.txt)