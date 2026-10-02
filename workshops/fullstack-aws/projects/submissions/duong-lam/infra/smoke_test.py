"""Smoke test for the deployed app (CloudFront site + API Gateway + Lambda). Read-only: it never signs in
and never changes data, so it's safe to run any time, e.g. after every redeploy.

Usage (from the project root):
    python infra/smoke_test.py                       # finds the site and API through the AWS CLI
    python infra/smoke_test.py --site https://dxxxx.cloudfront.net --api https://abc.execute-api.us-east-1.amazonaws.com

Part 1 tests the live URLs. Part 2 (only when the AWS CLI works) checks the AWS settings the guide asks for.
Exit code 0 = no FAIL (WARNs are things worth fixing that don't break the app).
"""
import argparse
import http.client
import json
import re
import shutil
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request
from urllib.parse import urlparse

FUNCTION = "duonglam-simplebank-api"
API_NAME = "duonglam-simplebank-http-api"
BUCKET = "duonglam-simplebank-site"
results = {"PASS": 0, "WARN": 0, "FAIL": 0}


def report(level: str, name: str, detail: str = "") -> None:
    results[level] += 1
    print(f"{level:4}  {name}" + (f"  ({detail})" if detail and level != "PASS" else ""))


def check(ok: bool, name: str, detail: str = "", warn_only: bool = False) -> bool:
    report("PASS" if ok else ("WARN" if warn_only else "FAIL"), name, detail)
    return ok


def fetch(url: str, method: str = "GET", headers: dict | None = None):
    """(status, headers with lowercase names, body text). Never raises for HTTP error codes."""
    req = urllib.request.Request(url, method=method, headers={"User-Agent": "simplebank-smoke-test", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=40, context=ssl.create_default_context()) as r:
            return r.status, {k.lower(): v for k, v in r.headers.items()}, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, {k.lower(): v for k, v in e.headers.items()}, e.read().decode("utf-8", "replace")


def aws(*args: str) -> str | None:
    exe = shutil.which("aws")   # full path (aws.exe on Windows), so no shell is needed to find it
    if not exe:
        return None
    try:
        out = subprocess.run([exe, *args, "--output", "json"], capture_output=True, text=True, timeout=60)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return out.stdout if out.returncode == 0 else None


def discover() -> tuple[str | None, str | None]:
    site = aws("lambda", "get-function-configuration", "--function-name", FUNCTION,
               "--query", "Environment.Variables.ALLOWED_ORIGINS")   # only this one setting, never the secrets
    api = aws("apigatewayv2", "get-apis", "--query", f"Items[?Name=='{API_NAME}'].ApiEndpoint | [0]")
    site = json.loads(site).split(",")[0].strip() if site and json.loads(site) else None
    api = json.loads(api) if api and json.loads(api) else None
    return site, api


def live_checks(site: str, api: str) -> None:
    print(f"\n== Part 1: live URLs\nsite: {site}\napi:  {api}\n")

    start = time.time()
    s, h, b = fetch(f"{api}/api/health")
    check(s == 200 and '"database":"ok"' in b.replace(" ", ""), "API health: up and reaching MongoDB",
          f"{s} {b[:120]}")
    print(f"      health answered in {time.time() - start:.1f}s (a few seconds = cold start)")

    s, h, page = fetch(f"{site}/")
    check(s == 200 and "text/html" in h.get("content-type", "") and 'id="root"' in page, "site / serves index.html",
          f"{s} {h.get('content-type')}")
    for path in ("/app", "/admin", "/login", "/reset-password?token=abc"):
        s, h, b = fetch(f"{site}{path}")
        check(s == 200 and 'id="root"' in b, f"refresh on {path} still loads the app", f"{s} (CloudFront error pages 403/404)")

    host = urlparse(site).netloc
    conn = http.client.HTTPConnection(host, timeout=20)
    conn.request("GET", "/")
    r = conn.getresponse()
    check(r.status in (301, 302, 307, 308) and (r.getheader("Location") or "").startswith("https://"),
          "http:// redirects to https://", f"{r.status} {r.getheader('Location')}")

    js = re.search(r'src="(/assets/[^"]+\.js)"', page)
    css = re.search(r'href="(/assets/[^"]+\.css)"', page)
    if check(bool(js), "index.html points at a JS bundle"):
        s, h, b = fetch(site + js.group(1))
        check(s == 200 and "javascript" in h.get("content-type", ""), "JS bundle served as JavaScript",
              f"{s} {h.get('content-type')}")
        check(f"{api}/api" in b, "site was built with VITE_API_URL = <api>/api",
              "rebuild: infra/console/redeploy_site.ps1")
        check("public" in h.get("cache-control", "") or "max-age" in h.get("cache-control", ""),
              "assets have a long Cache-Control", f"cache-control: {h.get('cache-control')}", warn_only=True)
    if css:
        s, h, _ = fetch(site + css.group(1))
        check(s == 200 and "text/css" in h.get("content-type", ""), "CSS served as text/css", f"{s} {h.get('content-type')}")

    s, h, b = fetch(f"{site}/favicon.svg")
    check(s == 200 and "svg" in h.get("content-type", ""), "browser-tab icon (favicon.svg)", f"{s} {h.get('content-type')}",
          warn_only=True)

    s, h, _ = fetch(f"{site}/")
    check("no-cache" in h.get("cache-control", ""), "index.html has Cache-Control: no-cache (new deploys show at once)",
          f"cache-control: {h.get('cache-control')}", warn_only=True)
    missing = [x for x in ("strict-transport-security", "x-content-type-options", "x-frame-options", "referrer-policy")
               if x not in h]
    check(not missing, "site sends security headers", "missing: " + ", ".join(missing), warn_only=True)

    pre = {"Origin": site, "Access-Control-Request-Method": "POST",
           "Access-Control-Request-Headers": "content-type,authorization"}
    s, h, _ = fetch(f"{api}/api/auth/login", "OPTIONS", pre)
    check(s == 200 and h.get("access-control-allow-origin") == site, "CORS: the site may call the API",
          f"{s} allow-origin={h.get('access-control-allow-origin')} (Lambda ALLOWED_ORIGINS must be exactly {site})")
    s, h, _ = fetch(f"{api}/api/auth/login", "OPTIONS", {**pre, "Origin": "https://evil.example"})
    check("access-control-allow-origin" not in h, "CORS: other websites may not", f"{s} {h.get('access-control-allow-origin')}")

    s, h, b = fetch(f"{api}/api/auth/me")
    check(s == 401, "protected route without a token answers 401", f"{s} {b[:80]}")
    check(h.get("x-frame-options") == "DENY" and h.get("cache-control") == "no-store",
          "API sends its security headers", f"{h.get('x-frame-options')} / {h.get('cache-control')}")
    s, _, _ = fetch(f"{api}/api/this-route-does-not-exist")
    check(s == 404, "unknown API route answers 404", str(s))


def config_checks() -> None:
    print("\n== Part 2: AWS settings")
    raw = aws("lambda", "get-function-configuration", "--function-name", FUNCTION, "--query",
              "{arch:Architectures[0],runtime:Runtime,handler:Handler,timeout:Timeout,memory:MemorySize,"
              "keys:keys(Environment.Variables)}")
    if raw is None:
        report("WARN", "AWS CLI not available or not logged in: skipped", "aws sts get-caller-identity")
        return
    fn = json.loads(raw)
    check(fn["arch"] == "x86_64", "Lambda architecture x86_64", fn["arch"])
    check(fn["handler"] == "lambda_handler.handler", "Lambda handler", fn["handler"])
    check(fn["timeout"] >= 15, "Lambda timeout at least 15 s", str(fn["timeout"]))
    check(fn["memory"] >= 512, "Lambda memory at least 512 MB", str(fn["memory"]))
    keys = set(fn["keys"] or [])
    need = {"MONGODB_URI", "MONGODB_DB", "JWT_SECRET", "ADMIN_PASSWORD", "ALLOWED_ORIGINS", "FRONTEND_URL"}
    check(need <= keys, "Lambda has every required setting", "missing: " + ", ".join(sorted(need - keys)))
    check("ORIGIN_SECRET" not in keys, "Lambda has no ORIGIN_SECRET (it would block the browser)")

    conc = aws("lambda", "get-function-concurrency", "--function-name", FUNCTION)
    check(bool(conc and json.loads(conc).get("ReservedConcurrentExecutions")),
          "Lambda reserved concurrency set (caps MongoDB connections and cost)", "none set", warn_only=True)

    apis = json.loads(aws("apigatewayv2", "get-apis", "--query", f"Items[?Name=='{API_NAME}']") or "[]")
    if check(bool(apis), "API Gateway API exists", API_NAME):
        api = apis[0]
        check(not api.get("CorsConfiguration"), "API Gateway CORS left empty (FastAPI does CORS)")
        stage = json.loads(aws("apigatewayv2", "get-stage", "--api-id", api["ApiId"], "--stage-name", "$default") or "{}")
        rs = stage.get("DefaultRouteSettings") or {}
        check(bool(rs.get("ThrottlingRateLimit")), "API Gateway throttling set",
              "Protect > Throttling: rate 25, burst 50", warn_only=True)

    dists = json.loads(aws("cloudfront", "list-distributions", "--query",
                           f"DistributionList.Items[?Origins.Items[?DomainName=='{BUCKET}.s3.us-east-1.amazonaws.com']].Id")
                       or "[]")
    if check(bool(dists), "CloudFront distribution for the bucket exists"):
        cfg = json.loads(aws("cloudfront", "get-distribution-config", "--id", dists[0]) or "{}")["DistributionConfig"]
        check(cfg.get("DefaultRootObject") == "index.html", "CloudFront default root object is index.html",
              repr(cfg.get("DefaultRootObject")), warn_only=True)
        errs = {e["ErrorCode"]: (e.get("ResponsePagePath"), e.get("ResponseCode"))
                for e in (cfg.get("CustomErrorResponses", {}).get("Items") or [])}
        check(errs.get(403) == ("/index.html", "200") and errs.get(404) == ("/index.html", "200"),
              "CloudFront error pages 403/404 -> /index.html 200", str(errs))
        beh = cfg["DefaultCacheBehavior"]
        check(beh.get("ViewerProtocolPolicy") == "redirect-to-https", "CloudFront redirects HTTP to HTTPS")
        check(bool(beh.get("ResponseHeadersPolicyId")), "CloudFront adds security headers (response headers policy)",
              warn_only=True)
        origin = cfg["Origins"]["Items"][0]
        check(bool(origin.get("OriginAccessControlId")), "S3 origin uses OAC (bucket stays private)")

    pab = aws("s3api", "get-public-access-block", "--bucket", BUCKET)
    check(bool(pab) and all(json.loads(pab)["PublicAccessBlockConfiguration"].values()),
          "S3 bucket blocks all public access")

    # Course rule: console-made resources carry workshop/date/autodelete tags. autodelete=false keeps the
    # weekly cleanup (cleanup-student-resources.py) from deleting them.
    fn_arn = json.loads(aws("lambda", "get-function", "--function-name", FUNCTION, "--query", "Configuration.FunctionArn") or "null")
    tags = json.loads(aws("lambda", "list-tags", "--resource", fn_arn) or "{}").get("Tags", {}) if fn_arn else {}
    check(tags.get("autodelete") == "false" and bool(tags.get("workshop")), "Lambda tagged workshop + autodelete=false",
          str(tags), warn_only=True)
    btags = json.loads(aws("s3api", "get-bucket-tagging", "--bucket", BUCKET) or "{}").get("TagSet", [])
    check({"Key": "autodelete", "Value": "false"} in btags, "bucket tagged autodelete=false", str(btags), warn_only=True)

    logs = json.loads(aws("logs", "describe-log-groups", "--log-group-name-prefix", f"/aws/lambda/{FUNCTION}") or "{}")
    days = (logs.get("logGroups") or [{}])[0].get("retentionInDays")
    check(bool(days), "Lambda logs expire (retention set)", "never expire", warn_only=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--site", help="https://dxxxx.cloudfront.net")
    parser.add_argument("--api", help="https://abc.execute-api.us-east-1.amazonaws.com (without /api)")
    parser.add_argument("--no-aws", action="store_true", help="skip part 2 (the AWS settings)")
    args = parser.parse_args()
    site, api = args.site, args.api
    if not (site and api):
        found_site, found_api = discover()
        site, api = site or found_site, api or found_api
    if not (site and api):
        sys.exit("Couldn't find the site and API through the AWS CLI. Pass --site and --api.")
    site, api = site.rstrip("/"), api.rstrip("/").removesuffix("/api")

    live_checks(site, api)
    if not args.no_aws:
        config_checks()
    print(f"\n{results['PASS']} passed, {results['WARN']} warnings, {results['FAIL']} failed")
    sys.exit(1 if results["FAIL"] else 0)


if __name__ == "__main__":
    main()
