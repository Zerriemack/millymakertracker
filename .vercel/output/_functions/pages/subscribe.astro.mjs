import { a as createComponent, r as renderComponent, d as renderTemplate, m as maybeRenderHead } from '../chunks/astro/server_BpFJd2pw.mjs';
import 'piccolore';
import { $ as $$Layout } from '../chunks/Layout_C4OFTAex.mjs';
export { renderers } from '../renderers.mjs';

const $$Subscribe = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Subscribe" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<h1>Subscribe</h1> <p>Get the morning after write up in your inbox.</p> <form> <label>
Email
<input type="email" name="email" placeholder="you@email.com" required> </label> <button type="submit">Subscribe</button> </form> <p>
This form is a placeholder. Next step is connecting Mailchimp, ConvertKit, or Buttondown.
</p> ` })}`;
}, "/Users/zerriemack/Desktop/millymakertracker.com/src/pages/subscribe.astro", void 0);

const $$file = "/Users/zerriemack/Desktop/millymakertracker.com/src/pages/subscribe.astro";
const $$url = "/subscribe";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Subscribe,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
