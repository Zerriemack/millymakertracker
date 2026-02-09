import { c as createAstro, a as createComponent, r as renderComponent, b as renderHead, e as renderSlot, d as renderTemplate } from './astro/server_BpFJd2pw.mjs';
import 'piccolore';
import { $ as $$BaseHead, a as $$Header, b as $$Footer } from './Header_D_V2he7r.mjs';
/* empty css                         */

const $$Astro = createAstro("https://millymakertracker.com");
const $$Layout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Layout;
  const { title = "Milly Maker Tracker" } = Astro2.props;
  return renderTemplate`<html lang="en" data-astro-cid-sckkx6r4> <head>${renderComponent($$result, "BaseHead", $$BaseHead, { "title": title, "data-astro-cid-sckkx6r4": true })}${renderHead()}</head> <body data-astro-cid-sckkx6r4> ${renderComponent($$result, "Header", $$Header, { "data-astro-cid-sckkx6r4": true })} <main class="container" data-astro-cid-sckkx6r4> ${renderSlot($$result, $$slots["default"])} </main> ${renderComponent($$result, "Footer", $$Footer, { "data-astro-cid-sckkx6r4": true })} </body></html>`;
}, "/Users/zerriemack/Desktop/millymakertracker.com/src/layouts/Layout.astro", void 0);

export { $$Layout as $ };
