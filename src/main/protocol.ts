import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as nodeUrl from 'url';

import { IpcEvents } from '../ipc-events';
import { ipcMainManager } from './ipc';

const PROTOCOL = 'electron-fiddle';
const squirrelPath = path.resolve(path.dirname(process.execPath), '..', 'electron-fiddle.exe');

const handlePotentialProtocolLaunch = (url: string) => {
  if (!app.isReady()) {
    app.once('ready', () => handlePotentialProtocolLaunch(url));
    return;
  }

  const parsed = nodeUrl.parse(url.replace(/\/$/, ''));
  if (!parsed.pathname || !parsed.hostname) return;

  const pathParts = parsed.pathname.split('/').slice(1);
  if (pathParts.length === 0) return;
  switch (parsed.hostname) {
    case 'gist':
      if (pathParts.length === 1) {
        // We only have a gist ID
        ipcMainManager.send(IpcEvents.LOAD_GIST_REQUEST, [{
          id: pathParts[0],
        }]);
      } else if (pathParts.length === 2) {
        // We have a gist owner and gist ID, we can ignore the owner
        ipcMainManager.send(IpcEvents.LOAD_GIST_REQUEST, [{
          id: pathParts[1],
        }]);
      } else {
        // This is a super invalid gist launch
        return;
      }
      break;
    case 'electron':
      break;
    default:
      return;
  }
};

export const scanArgv = (argv: Array<string>) => {
  const protocolArg = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
  if (protocolArg) {
    console.info('Found protocol arg in argv:', protocolArg);
    handlePotentialProtocolLaunch(protocolArg);
  }
};

export const listenForProtocolHandler = () => {
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) app.quit();

  app.on('open-url', (_, url) => {
    if (url.startsWith(`${PROTOCOL}://`)) {
      handlePotentialProtocolLaunch(url);
    }
  });

  if (process.platform === 'win32') {
    scanArgv(process.argv);
  }
};

export const setupProtocolHandler = () => {
  if (process.platform === 'win32' && !fs.existsSync(squirrelPath)) return;
  if (!app.isDefaultProtocolClient(PROTOCOL, squirrelPath)) {
    app.setAsDefaultProtocolClient(PROTOCOL, squirrelPath);
  }
};
