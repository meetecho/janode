#!/usr/bin/env bash

set -u

SCRIPT_PATH="$( cd "$(dirname "$0")" ; pwd -P )"
BUILD_DIR="$SCRIPT_PATH/app"
BUNDLE_FILENAME="bundle.js"
EXPORTED_OBJECT="App"
DEPLOY_DIR="/var/www/html"

# bundle with echotest plugin

pushd $SCRIPT_PATH

cat <<EOF > app.js
import Janode from '../../src/janode.js';
import EchoTestPlugin from '../../src/plugins/echotest-plugin.js';

export default {
    Janode,
    EchoTestPlugin,
}
EOF

cat <<EOF > config.js
import nodePolyfills from 'rollup-plugin-polyfill-node';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'app.js',
  output: {
    file: '$BUILD_DIR/$BUNDLE_FILENAME',
    format: 'iife',
    name: '$EXPORTED_OBJECT'
  },
  plugins: [
      nodePolyfills(),
      nodeResolve({ browser: true }),
      commonjs()
  ]
};
EOF

npm install --no-save rollup-plugin-polyfill-node @rollup/plugin-node-resolve @rollup/plugin-commonjs
rollup --config config.js

cp ./app/*.* $DEPLOY_DIR
rm *.js

popd