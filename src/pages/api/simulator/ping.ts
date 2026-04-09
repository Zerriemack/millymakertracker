import type { APIRoute } from "astro";

export const POST: APIRoute = async () => {
  return new Response(JSON.stringify({ ok: true, message: "pong" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ ok: true, message: "pong" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
