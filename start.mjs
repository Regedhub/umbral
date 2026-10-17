import {startRelay} from './server.mjs';
startRelay(undefined, process.env.HOST || '0.0.0.0');
