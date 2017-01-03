#!/bin/sh

set -e
cd /vagrant/

# Install dependencies
apt-get update
apt-get -y install nodejs npm

# Symlink node to nodejs
ln -s `which nodejs` /usr/bin/node