#!/usr/bin/env python3
"""Validate a Cursor harness capture against expected routing-critical fields."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


def main() -> int:
    args = parse_args()
    capture = json.loads(args.capture.read_text(encoding="utf-8"))
    request = read_object(capture, "request")
    analysis = read_object(capture, "analysis")
    body = read_object(request, "body_json")
    path = read_request_path(request)
    host = read_request_host(request)
    failures: list[str] = []

    expect_equal(
        failures,
        "analysis.cursor_facing_model_id",
        analysis.get("cursor_facing_model_id"),
        args.expect_model,
    )
    expect_equal(failures, "body_json.model", body.get("model"), args.expect_model)
    expect_equal(failures, "analysis.request_shape", analysis.get("request_shape"), args.expect_shape)
    if args.expect_path_prefix is not None:
        if path is None:
            failures.append("request.path: expected path to be present")
        elif not path.startswith(args.expect_path_prefix):
            failures.append(f"request.path: expected prefix {args.expect_path_prefix!r}, got {path!r}")
    if args.expect_host is not None:
        if host is None:
            failures.append("request.host: expected Host/X-Forwarded-Host/url host to be present")
        else:
            expect_equal(failures, "request.host", normalize_host(host), normalize_host(args.expect_host))

    if args.expect_reasoning_effort is not None or args.expect_reasoning_summary is not None:
        reasoning = body.get("reasoning")
        if not isinstance(reasoning, dict):
            failures.append("body_json.reasoning: expected object, got missing/non-object")
        else:
            if args.expect_reasoning_effort is not None:
                expect_equal(
                    failures,
                    "body_json.reasoning.effort",
                    reasoning.get("effort"),
                    args.expect_reasoning_effort,
                )
            if args.expect_reasoning_summary is not None:
                expect_equal(
                    failures,
                    "body_json.reasoning.summary",
                    reasoning.get("summary"),
                    args.expect_reasoning_summary,
                )

    if failures:
        print(f"capture verification failed: {args.capture}", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1

    print(
        "capture verified: "
        f"model={args.expect_model} "
        f"shape={args.expect_shape} "
        f"path={path or '<not captured>'} "
        f"host={host or '<not captured>'} "
        f"reasoning_effort={args.expect_reasoning_effort or '<not checked>'} "
        f"reasoning_summary={args.expect_reasoning_summary or '<not checked>'}"
    )
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate a Cursor harness capture JSON file")
    parser.add_argument("capture", type=Path, help="Path to a harness-capture/captures/*.json file")
    parser.add_argument("--expect-model", required=True, help="Expected body.model / Cursor-Facing Model ID")
    parser.add_argument(
        "--expect-shape",
        required=True,
        choices=("responses", "chat_completions", "unknown_json", "unknown"),
        help="Expected captured request shape",
    )
    parser.add_argument("--expect-reasoning-effort", help="Expected body.reasoning.effort")
    parser.add_argument("--expect-reasoning-summary", help="Expected body.reasoning.summary")
    parser.add_argument(
        "--expect-path-prefix",
        help="Expected request path prefix, for example /v1/chat/completions or /v1",
    )
    parser.add_argument(
        "--expect-host",
        help="Expected public-route host from Host/X-Forwarded-Host/url, optionally including a port",
    )
    return parser.parse_args()


def read_object(parent: dict[str, Any], key: str) -> dict[str, Any]:
    value = parent.get(key)
    if not isinstance(value, dict):
        raise SystemExit(f"capture is missing object field: {key}")
    return value


def expect_equal(failures: list[str], label: str, actual: Any, expected: str) -> None:
    if actual != expected:
        failures.append(f"{label}: expected {expected!r}, got {actual!r}")


def read_request_path(request: dict[str, Any]) -> str | None:
    path = request.get("path")
    if isinstance(path, str) and path:
        return path

    target = request.get("target")
    if isinstance(target, str) and target.startswith("/"):
        return target

    url = request.get("url")
    if isinstance(url, str) and url:
        parsed = urlparse(url)
        if parsed.path:
            return parsed.path
        if url.startswith("/"):
            return url.split("?", 1)[0]

    return None


def read_request_host(request: dict[str, Any]) -> str | None:
    headers = request.get("headers")
    if isinstance(headers, dict):
        host = read_header(headers, "x-forwarded-host") or read_header(headers, "host")
        if host:
            return host.split(",", 1)[0].strip()

    url = request.get("url")
    if isinstance(url, str) and url:
        parsed = urlparse(url)
        if parsed.netloc:
            return parsed.netloc

    return None


def read_header(headers: dict[Any, Any], wanted: str) -> str | None:
    for key, value in headers.items():
        if isinstance(key, str) and key.lower() == wanted and isinstance(value, str) and value.strip():
            return value.strip()
    return None


def normalize_host(host: str) -> str:
    value = host.strip().lower()
    if value.startswith("https://") or value.startswith("http://"):
        parsed = urlparse(value)
        return parsed.netloc or parsed.path
    return value


if __name__ == "__main__":
    raise SystemExit(main())
