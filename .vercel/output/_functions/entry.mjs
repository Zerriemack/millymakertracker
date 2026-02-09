import { renderers } from './renderers.mjs';
import { c as createExports, s as serverEntrypointModule } from './chunks/_@astrojs-ssr-adapter_EcCuZa3N.mjs';
import { manifest } from './manifest_BQsTC5jr.mjs';

const serverIslandMap = new Map();;

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/about.astro.mjs');
const _page2 = () => import('./pages/analysis.astro.mjs');
const _page3 = () => import('./pages/api/health.astro.mjs');
const _page4 = () => import('./pages/blog.astro.mjs');
const _page5 = () => import('./pages/cfb.astro.mjs');
const _page6 = () => import('./pages/nfl.astro.mjs');
const _page7 = () => import('./pages/rss.xml.astro.mjs');
const _page8 = () => import('./pages/slates.astro.mjs');
const _page9 = () => import('./pages/subscribe.astro.mjs');
const _page10 = () => import('./pages/winners.astro.mjs');
const _page11 = () => import('./pages/index.astro.mjs');
const pageMap = new Map([
    ["node_modules/astro/dist/assets/endpoint/generic.js", _page0],
    ["src/pages/about.astro", _page1],
    ["src/pages/analysis.astro", _page2],
    ["src/pages/api/health.ts", _page3],
    ["src/pages/blog/index.astro", _page4],
    ["src/pages/cfb/index.astro", _page5],
    ["src/pages/nfl/index.astro", _page6],
    ["src/pages/rss.xml.js", _page7],
    ["src/pages/slates.astro", _page8],
    ["src/pages/subscribe.astro", _page9],
    ["src/pages/winners.astro", _page10],
    ["src/pages/index.astro", _page11]
]);

const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    actions: () => import('./noop-entrypoint.mjs'),
    middleware: () => import('./_noop-middleware.mjs')
});
const _args = {
    "middlewareSecret": "9233740a-8be4-4401-aa4c-615a1c6f940a",
    "skewProtection": false
};
const _exports = createExports(_manifest, _args);
const __astrojsSsrVirtualEntry = _exports.default;
const _start = 'start';
if (Object.prototype.hasOwnProperty.call(serverEntrypointModule, _start)) ;

export { __astrojsSsrVirtualEntry as default, pageMap };
