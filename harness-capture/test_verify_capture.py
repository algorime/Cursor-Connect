#!/usr/bin/env python3
"""Regression tests for the harness capture verifier CLI."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent
VERIFY_CAPTURE = ROOT / "verify_capture.py"
DIRECT_GPT55_PROOF = ROOT / "release-proof" / "direct-gpt-5.5-phase3.json"


class VerifyCaptureTest(unittest.TestCase):
    def test_accepts_expected_model_shape_path_host_and_reasoning(self) -> None:
        result = run_verify([
            "--expect-model", "gpt-5.5",
            "--expect-shape", "responses",
            "--expect-path-prefix", "/v1/chat",
            "--expect-host", "codex.example.com",
            "--expect-reasoning-effort", "medium",
            "--expect-reasoning-summary", "auto",
        ])

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("path=/v1/chat/completions", result.stdout)
        self.assertIn("host=codex.example.com", result.stdout)

    def test_rejects_wrong_request_path(self) -> None:
        result = run_verify([
            "--expect-model", "gpt-5.5",
            "--expect-shape", "responses",
            "--expect-path-prefix", "/v1/responses",
            "--expect-host", "codex.example.com",
        ])

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("request.path", result.stderr)

    def test_rejects_wrong_public_host(self) -> None:
        result = run_verify([
            "--expect-model", "gpt-5.5",
            "--expect-shape", "responses",
            "--expect-path-prefix", "/v1/chat",
            "--expect-host", "wrong.example.com",
        ])

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("request.host", result.stderr)

    def test_release_proof_fixture_validates_direct_gpt55_route(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(VERIFY_CAPTURE),
                str(DIRECT_GPT55_PROOF),
                "--expect-model", "gpt-5.5",
                "--expect-shape", "responses",
                "--expect-path-prefix", "/v1",
                "--expect-host", "phase3-proof.example.com",
                "--expect-reasoning-effort", "low",
                "--expect-reasoning-summary", "auto",
            ],
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("model=gpt-5.5", result.stdout)
        self.assertIn("path=/v1/chat/completions", result.stdout)
        self.assertIn("reasoning_effort=low", result.stdout)


def run_verify(args: list[str]) -> subprocess.CompletedProcess[str]:
    with tempfile.TemporaryDirectory() as temp_dir:
        capture = Path(temp_dir) / "capture.json"
        capture.write_text(json.dumps(sample_capture()), encoding="utf-8")
        return subprocess.run(
            [sys.executable, str(VERIFY_CAPTURE), str(capture), *args],
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )


def sample_capture() -> dict[str, object]:
    return {
        "request": {
            "method": "POST",
            "path": "/v1/chat/completions",
            "headers": {
                "Host": "127.0.0.1:50151",
                "X-Forwarded-Host": "codex.example.com",
            },
            "body_json": {
                "model": "gpt-5.5",
                "input": [{"role": "user", "content": "probe"}],
                "reasoning": {"effort": "medium", "summary": "auto"},
            },
        },
        "analysis": {
            "cursor_facing_model_id": "gpt-5.5",
            "request_shape": "responses",
        },
    }


if __name__ == "__main__":
    unittest.main()
