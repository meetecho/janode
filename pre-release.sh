#!/bin/bash -eu

REL=$1

if [ -z "$REL" ]; then
  echo "A release name must be specified"
  exit 1
fi

npm version "$REL" -m "version: bump to $REL"
npm publish --dry-run
