from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    status_code = 400

    def __init__(self, message: str, **extra: object):
        super().__init__(message)
        self.message = message
        self.extra = extra


class NotFound(AppError):
    status_code = 404


class Conflict(AppError):
    """Duplicate slug, stale `version`, or an invalid lifecycle move."""

    status_code = 409


class Invalid(AppError):
    status_code = 422


class Forbidden(AppError):
    status_code = 403


def install(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _handle(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse({"detail": exc.message, **exc.extra}, status_code=exc.status_code)
