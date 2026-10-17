import classify from '@kamkam1_0/music-search/src/utils/eval.js';
import {parseInput} from './music-safety.mjs';
export const PACKAGE_VERSION='5.0.4';
export function classifySafe(value){const safe=parseInput(value);const legacy=classify(safe.url);return {...safe,packageHint:legacy?.plateform||null};}
