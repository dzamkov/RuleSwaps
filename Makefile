MAKEFLAGS += -r

PATH := $(CURDIR)/node_modules/.bin:$(PATH)
SHELL := /bin/sh

MODE ?= DEBUG

output_dir := output
source_dir := source

common_files := \
	card.js \
	game.js \
	cards.js \
	format.js \
	cookie.js
client_common_files := $(common_files) \
	client/net.js \
	client/motion.js \
	client/ui.js \
	client/interface.js
server_files := $(common_files) \
	server/util.js \
	server/user.js \
	server/game.js \
	server/lobby.js \
	server.js

pages := \
	home \
	game \
	lobby \
	decklist

$(output_dir): $(output_dir)/static $(output_dir)/server.js $(output_dir)/config

$(output_dir)/config:
	echo $(MODE) > $@

$(output_dir)/static: \
	$(output_dir)/static/images \
	$(output_dir)/static/common.js \
	$(output_dir)/static/scripts \
	$(addprefix $(output_dir)/static/, \
		$(addsuffix .html,$(pages)) \
		$(addsuffix .css,$(pages)) \
		$(addsuffix .js,$(pages)))
	
$(output_dir)/static/images: $(source_dir)/static/images/*
	mkdir -p $(dir $@)
	rsync -rupE $(source_dir)/static/images $(@D)

ifeq ($(MODE),RELEASE)
$(output_dir)/static/%.js: $(source_dir)/client/%.js
	mkdir -p $(dir $@)
	terser $^ --compress -o $@
	
$(output_dir)/static/common.js: $(addprefix $(source_dir)/,$(client_common_files))
	mkdir -p $(dir $@)
	terser $^ --compress -o $@
	
$(output_dir)/server.js:  $(addprefix $(source_dir)/,$(server_files))
	mkdir -p $(dir $@)
	terser $^ --compress -o $@
	
$(output_dir)/static/%.css: $(source_dir)/style/*
	mkdir -p $(dir $@)
	sass $(source_dir)/style/$(*F).scss --style=compressed > $@

$(output_dir)/static/%.html: $(source_dir)/static/%.html
	mkdir -p $(dir $@)
	html-minifier $< --collapse-whitespace -o $@

$(output_dir)/static/scripts:
endif

ifeq ($(MODE),DEBUG)
$(output_dir)/static/%.css: $(source_dir)/style/*
	mkdir -p $(dir $@)
	sass $(source_dir)/style/$(*F).scss > $@

$(output_dir)/static/%.html: $(source_dir)/static/%.html
	mkdir -p $(dir $@)
	cp $< $@
	
$(output_dir)/static/%.js: $(source_dir)/client/%.js
	mkdir -p $(dir $@)
	cp $< $@

$(output_dir)/static/common.js:
	mkdir -p $(dir $@)
	> $@; \
	for file in $(client_common_files); do \
		echo "document.write('<script type=\"text/javascript\" src=\"/static/scripts/"$$file"\"></script>');" >> $@; \
	done

$(output_dir)/static/scripts: $(addprefix $(source_dir)/,$(client_common_files))
	mkdir -p $@
	mkdir -p $@/client
	for file in $(client_common_files); do \
		cp $(source_dir)/$$file $@/$$file; \
	done

$(output_dir)/scripts: $(addprefix $(source_dir)/,$(server_files))
	mkdir -p $@
	for file in $(server_files); do \
		cp $(source_dir)/$$file $@/$$file; \
	done

$(output_dir)/server.js: $(addprefix $(source_dir)/,$(server_files))
	mkdir -p $(dir $@)
	echo "\"use strict\";" > $@; \
	cat $^ >> $@
endif
	
$(output_dir)/fuzzer.js: $(addprefix $(source_dir)/,$(common_files)) $(source_dir)/fuzzer.js
	mkdir -p $(dir $@)
	echo "\"use strict\";" > $@; \
	cat $^ >> $@

.PHONY: clean all
clean:
	rm -rf $(output_dir)/*
	
all: $(output_dir)