import { a as createComponent, r as renderComponent, d as renderTemplate, m as maybeRenderHead } from '../chunks/astro/server_BpFJd2pw.mjs';
import 'piccolore';
import { $ as $$Layout } from '../chunks/Layout_C4OFTAex.mjs';
export { renderers } from '../renderers.mjs';

const $$Index = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Milly Maker Tracker" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<main> <h1>Milly Maker Tracker</h1> <p>
A running archive of DraftKings NFL Milly Maker winning lineups, organized by slate.
</p> <p>
Start here: <a href="/winners">browse winners</a> or <a href="/slates">pick a slate</a>.
</p> </main> ` })}`;
}, "/Users/zerriemack/Desktop/millymakertracker.com/src/pages/index.astro", void 0);

const $$file = "/Users/zerriemack/Desktop/millymakertracker.com/src/pages/index.astro";
const $$url = "";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
