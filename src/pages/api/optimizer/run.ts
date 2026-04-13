import type { APIRoute } from "astro";

import {
  buildOptimizerResponse,
  GenerateLineupError,
  validateOptimizeRequest,
} from "../../../lib/optimizer/optimize";

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return new Response(
      JSON.stringify({
        message: "Invalid request payload.",
        error_code: "INVALID_PAYLOAD",
        errors: [
          {
            field: "body",
            message: error instanceof Error ? error.message : "Invalid JSON payload",
          },
        ],
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  const validation = validateOptimizeRequest(body);
  if (!validation.ok) {
    return new Response(
      JSON.stringify({
        message: "Invalid request payload.",
        error_code: "INVALID_PAYLOAD",
        errors: validation.errors,
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  try {
    const data = buildOptimizerResponse(validation.value);
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    if (error instanceof GenerateLineupError) {
      return new Response(
        JSON.stringify({
          message: "Unable to generate a valid lineup from this player pool.",
          error_code: error.code,
          reason: error.message,
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        message: "Unexpected optimizer error.",
        error_code: "OPTIMIZER_ERROR",
        reason: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
};
