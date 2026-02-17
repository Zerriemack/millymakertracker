import type { APIRoute } from "astro";
import fs from "node:fs";
import path from "node:path";

function respond(status: number, body: any) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export const GET: APIRoute = async ({ params }) => {
  const id = String(params.id || "").trim();
  if (!id) return respond(400, { error: "Missing id" });

  const abs = path.join(process.cwd(), "public", "analytics", "slates", `${id}.json`);

  if (!fs.existsSync(abs)) {
    return respond(404, {
      error: "Analytics JSON not found",
      expected: `/analytics/slates/${id}.json`,
      checkedAbs: abs,
    });
  }

  try {
    const raw = fs.readFileSync(abs, "utf-8");
    const data = JSON.parse(raw);
    return respond(200, data);
  } catch (err: any) {
    return respond(500, {
      error: "Failed to read or parse analytics JSON",
      message: String(err?.message || err),
      checkedAbs: abs,
    });
  }
};
