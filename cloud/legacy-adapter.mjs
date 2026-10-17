import {parseInput} from './music-safety.mjs';
export const PACKAGE_VERSION=null;
export function classifySafe(value){const item=parseInput(value);if(item.platform!=='youtube')throw Object.assign(Error('目前只支援 YouTube'),{status:400});return item;}
