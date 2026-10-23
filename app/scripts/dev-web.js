/* Starts the Expo web dev server from this folder, whatever directory it is launched from.
   Expo Router builds its typed routes relative to the working directory, so starting it from
   the repo root (as .claude/launch.json does) would fill .expo/types with wrong paths. */
const path = require('path');

process.chdir(path.join(__dirname, '..'));
process.argv = [process.argv[0], require.resolve('expo/bin/cli'), 'start', '--web', '--port', process.env.PORT || '8081'];
require('expo/bin/cli');
