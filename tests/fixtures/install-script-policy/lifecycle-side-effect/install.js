'use strict';

const fs = require('node:fs');
const path = require('node:path');

if (!process.env.INIT_CWD) throw new Error('INIT_CWD is required for the lifecycle fixture');
fs.writeFileSync(path.join(process.env.INIT_CWD, 'side-effect-marker'), 'install script executed\n');
