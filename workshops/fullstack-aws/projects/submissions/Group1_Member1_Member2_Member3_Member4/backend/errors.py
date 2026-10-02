"""Business errors raised by services; main.py turns them into HTTP responses."""


class AppError(Exception):
    status_code = 400

    def __init__(self, detail: str, extra: dict | None = None):
        super().__init__(detail)
        self.detail = detail
        self.extra = extra or {}


class BadRequest(AppError):
    status_code = 400


class Unauthorized(AppError):
    status_code = 401


class Forbidden(AppError):
    status_code = 403


class NotFound(AppError):
    status_code = 404


class Conflict(AppError):
    status_code = 409
