import fs from 'node:fs';

const sw = fs.readFileSync('dist/sw.js', 'utf8');
console.log('Includes .wasm in service worker precache:', sw.includes('.wasm'));

const matches = sw.match(/assets\/qualution_core_bg-[^'"]+\.wasm/g);
console.log('Matched WASM assets in service worker:', matches);

// Check runtime caching patterns in sw.js
const hasEngineCache = sw.includes('qualution-engine-bundles');
console.log('Includes qualution-engine-bundles CacheFirst policy:', hasEngineCache);
