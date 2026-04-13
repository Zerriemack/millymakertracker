import logging
import time

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydfs_lineup_optimizer.exceptions import GenerateLineupException

from app.optimizer import build_optimizer_response
from app.schemas import OptimizeRequest


app = FastAPI()
logger = logging.getLogger("optimizer")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning("invalid optimize request: %s", exc.errors())
    return JSONResponse(
        status_code=400,
        content={
            "message": "Invalid request payload.",
            "errors": exc.errors(),
        },
    )


@app.get("/")
def root():
    return {"message": "optimizer engine is running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/optimize")
def optimize(request: OptimizeRequest):
    start_time = time.perf_counter()
    logger.info(
        "optimize request received: players=%s lineup_count=%s min_salary=%s max_salary=%s max_repeating=%s",
        len(request.players),
        request.lineup_count,
        request.min_salary,
        request.max_salary,
        request.max_repeating_players,
    )
    try:
        response = build_optimizer_response(request)
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        logger.info(
            "optimize request completed: lineups=%s elapsed_ms=%.2f",
            response.get("lineup_count_returned"),
            elapsed_ms,
        )
        return response
    except GenerateLineupException as exc:
        logger.warning("optimize request failed to generate lineup: %s", exc)
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Unable to generate a valid lineup from this player pool.",
                "reason": str(exc),
            },
        )
    except Exception as exc:
        logger.exception("unexpected optimizer error")
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Unexpected optimizer error.",
                "reason": str(exc),
            },
        )
