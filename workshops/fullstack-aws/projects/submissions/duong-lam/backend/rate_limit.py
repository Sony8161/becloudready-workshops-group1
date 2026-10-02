"""A small per-IP rate limit for the "forgot" endpoints, so nobody can flood someone's inbox
or probe thousands of emails. It keeps counts in memory: fine for one server.
With several servers behind a load balancer, keep the counts in Redis instead."""
import os
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

_hits: dict[str, deque] = defaultdict(deque)

# Set only on AWS (see infra/). It proves a request came through OUR CloudFront.
BEHIND_CLOUDFRONT = bool(os.getenv("ORIGIN_SECRET"))


def client_ip(request: Request) -> str | None:
    """The caller's IP address. On AWS every request comes from a CloudFront server, so
    request.client.host would be CloudFront's IP for everyone. CloudFront passes the real one in
    the CloudFront-Viewer-Address header ("203.0.113.7:51234" = IP:port), so we use that there."""
    viewer = request.headers.get("cloudfront-viewer-address")
    if BEHIND_CLOUDFRONT and viewer:
        return viewer.rsplit(":", 1)[0].strip("[]")   # drop the port (and IPv6 brackets)
    return request.client.host if request.client else None


def limit(name: str, max_calls: int, per_seconds: int):
    """Use as a dependency: dependencies=[Depends(limit("forgot", 5, 900))] = 5 calls per 15 minutes per IP."""
    def check(request: Request) -> None:
        key = f"{name}:{client_ip(request) or 'unknown'}"
        now = time.monotonic()
        calls = _hits[key]
        while calls and now - calls[0] > per_seconds:
            calls.popleft()   # forget calls older than the window
        if len(calls) >= max_calls:
            raise HTTPException(status_code=429, detail="Too many requests. Please wait a few minutes and try again.")
        calls.append(now)
    return check
