import { c as createAstro, a as createComponent, m as maybeRenderHead, f as addAttribute, d as renderTemplate } from './astro/server_BpFJd2pw.mjs';
import 'piccolore';
import 'clsx';

const $$Astro = createAstro("https://millymakertracker.com");
const $$FormattedDate = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$FormattedDate;
  const { date } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<time${addAttribute(date.toISOString(), "datetime")}> ${date.toLocaleDateString("en-us", {
    year: "numeric",
    month: "short",
    day: "numeric"
  })} </time>`;
}, "/Users/zerriemack/Desktop/millymakertracker.com/src/components/FormattedDate.astro", void 0);

export { $$FormattedDate as $ };
