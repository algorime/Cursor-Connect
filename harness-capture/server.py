#!/usr/bin/env python3
"""Minimal Cursor harness capture server.

This server intentionally accepts any OpenAI-compatible path, records the raw
synthetic request shape, and returns a tiny OpenAI-compatible response so Cursor
can continue far enough for harness-routing research.
"""

from __future__ import annotations

import argparse
import json
import os
import time
import uuid
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse


SENSITIVE_HEADERS = {
    "authorization",
    "cookie",
    "proxy-authorization",
    "x-api-key",
    "api-key",
    "api_key",
    "x-azure-openai-key",
    "azure-openai-key",
}

DEFAULT_MODELS = (
    "gpt-5.4",
    "gpt-5.5",
    "gpt-5.4-mini",
    "gpt-5-codex",
    "codex-gpt-5.5-capture",
    "claude-opus-4.7-capture",
    "claude-sonnet-capture",
)


class CaptureConfig:
    def __init__(self, capture_dir: Path, models: tuple[str, ...]) -> None:
        self.capture_dir = capture_dir
        self.models = models


def redact_headers(headers: dict[str, str]) -> dict[str, str]:
    redacted: dict[str, str] = {}
    for key, value in headers.items():
        if key.lower() in SENSITIVE_HEADERS:
            redacted[key] = redact_value(value)
        else:
            redacted[key] = value
    return redacted


def redact_value(value: str) -> str:
    if not value:
        return value
    if len(value) <= 12:
        return "<redacted>"
    return f"{value[:6]}...{value[-4:]}"


def parse_json_body(body: bytes) -> Any:
    if not body:
        return None
    try:
        return json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None


def body_text(body: bytes) -> str:
    return body.decode("utf-8", errors="replace") if body else ""


def requested_model(parsed_body: Any) -> str:
    if isinstance(parsed_body, dict):
        model = parsed_body.get("model")
        if isinstance(model, str) and model:
            return model
    return "capture-model"


def request_shape(parsed_body: Any) -> str:
    if not isinstance(parsed_body, dict):
        return "unknown"
    if "messages" in parsed_body:
        return "chat_completions"
    if "input" in parsed_body:
        return "responses"
    return "unknown_json"


def wants_stream(parsed_body: Any) -> bool:
    return isinstance(parsed_body, dict) and parsed_body.get("stream") is True


class CaptureHandler(BaseHTTPRequestHandler):
    server_version = "CursorHarnessCapture/0.1"

    @property
    def config(self) -> CaptureConfig:
        return self.server.config  # type: ignore[attr-defined]

    def log_message(self, fmt: str, *args: Any) -> None:
        timestamp = time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime())
        print(f"[{timestamp}] {self.address_string()} {fmt % args}", flush=True)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("access-control-allow-origin", "*")
        self.send_header("access-control-allow-methods", "GET,POST,OPTIONS")
        self.send_header("access-control-allow-headers", "authorization,content-type")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed_url = urlparse(self.path)
        if parsed_url.path.rstrip("/") in {"", "/health", "/ready"}:
            self._send_json({"status": "ok", "captures": str(self.config.capture_dir)})
            return
        if parsed_url.path.rstrip("/") in {"/models", "/v1/models"}:
            self._send_json(
                {
                    "object": "list",
                    "data": [
                        {
                            "id": model,
                            "object": "model",
                            "created": 1686935002,
                            "owned_by": "harness-capture",
                        }
                        for model in self.config.models
                    ],
                }
            )
            return
        self._send_json({"status": "ok", "path": parsed_url.path})

    def do_POST(self) -> None:  # noqa: N802
        body = self._read_body()
        parsed_body = parse_json_body(body)
        capture_path = self._write_capture(body, parsed_body)
        model = requested_model(parsed_body)
        if wants_stream(parsed_body):
            self._send_chat_sse(model, capture_path.name)
        else:
            self._send_chat_json(model, capture_path.name)

    def _read_body(self) -> bytes:
        content_length = int(self.headers.get("content-length") or "0")
        if content_length <= 0:
            return b""
        return self.rfile.read(content_length)

    def _write_capture(self, body: bytes, parsed_body: Any) -> Path:
        parsed_url = urlparse(self.path)
        capture_id = f"{time.strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}"
        capture = {
            "capture_id": capture_id,
            "captured_at": time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime()),
            "client": {"address": self.client_address[0], "port": self.client_address[1]},
            "request": {
                "method": self.command,
                "path": parsed_url.path,
                "query": parse_qs(parsed_url.query, keep_blank_values=True),
                "headers": redact_headers({key: value for key, value in self.headers.items()}),
                "body_text": body_text(body),
                "body_json": parsed_body,
            },
            "analysis": {
                "cursor_facing_model_id": requested_model(parsed_body),
                "request_shape": request_shape(parsed_body),
                "stream": wants_stream(parsed_body),
            },
        }
        self.config.capture_dir.mkdir(parents=True, exist_ok=True)
        path = self.config.capture_dir / f"{capture_id}.json"
        path.write_text(json.dumps(capture, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"captured {path}", flush=True)
        return path

    def _send_json(self, payload: dict[str, Any], status: int = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.send_header("access-control-allow-origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _send_chat_json(self, model: str, capture_file: str) -> None:
        self._send_json(
            {
                "id": f"chatcmpl-capture-{uuid.uuid4().hex[:8]}",
                "object": "chat.completion",
                "created": int(time.time()),
                "model": model,
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": f"harness capture recorded: {capture_file}",
                        },
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
            }
        )

    def _send_chat_sse(self, model: str, capture_file: str) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("content-type", "text/event-stream")
        self.send_header("cache-control", "no-cache")
        self.send_header("x-accel-buffering", "no")
        self.send_header("access-control-allow-origin", "*")
        self.end_headers()

        chat_id = f"chatcmpl-capture-{uuid.uuid4().hex[:8]}"
        created = int(time.time())
        chunks = [
            {"role": "assistant"},
            {"content": f"harness capture recorded: {capture_file}"},
        ]
        for delta in chunks:
            payload = {
                "id": chat_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": model,
                "choices": [{"index": 0, "delta": delta, "finish_reason": None}],
            }
            self.wfile.write(f"data: {json.dumps(payload, ensure_ascii=False)}\n\n".encode("utf-8"))
            self.wfile.flush()

        final_payload = {
            "id": chat_id,
            "object": "chat.completion.chunk",
            "created": created,
            "model": model,
            "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
        }
        self.wfile.write(f"data: {json.dumps(final_payload, ensure_ascii=False)}\n\n".encode("utf-8"))
        self.wfile.write(b"data: [DONE]\n\n")
        self.wfile.flush()


class CaptureServer(ThreadingHTTPServer):
    def __init__(self, server_address: tuple[str, int], config: CaptureConfig) -> None:
        super().__init__(server_address, CaptureHandler)
        self.config = config


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Cursor harness capture server")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind")
    parser.add_argument("--port", type=int, default=5057, help="Port to bind")
    parser.add_argument(
        "--capture-dir",
        default=str(Path(__file__).with_name("captures")),
        help="Directory for capture JSON files",
    )
    parser.add_argument(
        "--models",
        default=os.environ.get("CAPTURE_MODELS", ",".join(DEFAULT_MODELS)),
        help="Comma-separated model IDs returned by /v1/models",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    models = tuple(model.strip() for model in args.models.split(",") if model.strip())
    config = CaptureConfig(capture_dir=Path(args.capture_dir), models=models)
    server = CaptureServer((args.host, args.port), config)
    print(f"harness capture server listening on http://{args.host}:{args.port}", flush=True)
    print(f"captures: {config.capture_dir}", flush=True)
    print("use base URL: http://<host>:<port>/v1", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("shutting down", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
