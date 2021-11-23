#!/usr/bin/env bash

set -u

SCRIPT_PATH="$( cd "$(dirname "$0")" ; pwd -P )"
BUILD_DIR="$SCRIPT_PATH/app"
BUNDLE_FILENAME="bundle.js"
EXPORTED_OBJECT="libJanode"
DEPLOY_DIR="/var/www/html"

# bundle with echotest plugin

pushd $SCRIPT_PATH

cat <<EOF > app.js
module.exports = { Janode: require('../../src/janode.js'), EchoTestPlugin: require('../../src/plugins/echotest-plugin.js') };
EOF

browserify app.js --standalone $EXPORTED_OBJECT -o $BUILD_DIR/$BUNDLE_FILENAME \
    --dg=false \
    --ignore "../../src/transport-unix.js"

cp ./app/*.* $DEPLOY_DIR

rm app.js

popd