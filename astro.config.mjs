// @ts-check

import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://millymakertracker.com",
  output: "server",
  adapter: vercel(),
  integrations: [mdx(), sitemap()],
});
