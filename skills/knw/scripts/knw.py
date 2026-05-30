#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.14,<3.15"
# dependencies = ["httpx==0.28.1"]
# ///
"""Access the knw facts retrieval service."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any
from urllib.parse import quote

import httpx

REQUEST_TIMEOUT_SECONDS = 10.0
SKILL_DIRECTORY = Path(__file__).resolve().parent.parent


def load_env() -> None:
    """Load skill-local configuration without overriding exported variables."""
    env_path = SKILL_DIRECTORY / ".env"
    if not env_path.is_file():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        normalized_key = key.strip()
        normalized_value = value.strip()
        if normalized_key and normalized_key not in os.environ:
            os.environ[normalized_key] = strip_matching_quotes(normalized_value)


def strip_matching_quotes(value: str) -> str:
    """Remove one matching pair of simple quotes from an env value."""
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value


def print_json(value: object, *, stream: Any = sys.stdout) -> None:
    """Print one JSON value for stable agent consumption."""
    json.dump(value, stream, ensure_ascii=True)
    stream.write("\n")


def fail(code: str, message: str, **details: object) -> None:
    """Print a structured CLI error and exit unsuccessfully."""
    error: dict[str, object] = {"code": code, "message": message}
    error.update(details)
    print_json({"error": error}, stream=sys.stderr)
    raise SystemExit(1)


def required_env(name: str) -> str:
    """Return a required environment variable or exit with a useful error."""
    value = os.environ.get(name, "").strip()
    if not value:
        fail("configuration_error", f"{name} is required")
    return value


def request_json(
    method: str,
    path: str,
    *,
    body: dict[str, object] | None = None,
    authenticated: bool = True,
) -> object:
    """Send one JSON API request and decode its response."""
    endpoint = required_env("KNW_ENDPOINT").rstrip("/")
    headers = {"Accept": "application/json"}

    if authenticated:
        headers["Authorization"] = f"Bearer {required_env('KNW_API_KEY')}"

    if body is not None:
        headers["Content-Type"] = "application/json"

    try:
        response = httpx.request(
            method,
            f"{endpoint}{path}",
            headers=headers,
            json=body,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except httpx.RequestError as error:
        fail("network_error", f"Request failed: {error}")

    if not response.is_success:
        fail_http(response)

    return decode_json(response.content)


def decode_json(raw_body: bytes) -> object:
    """Decode a JSON response or exit with a structured error."""
    try:
        return json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        fail("invalid_response", "Service returned invalid JSON")


def fail_http(response: httpx.Response) -> None:
    """Report an HTTP error while preserving structured service errors."""
    try:
        response_body = response.json()
    except (UnicodeDecodeError, json.JSONDecodeError):
        fail(
            "http_error",
            f"Service returned HTTP {response.status_code}",
            status=response.status_code,
        )

    print_json(response_body, stream=sys.stderr)
    raise SystemExit(1)


def create_parser() -> argparse.ArgumentParser:
    """Create the command-line interface."""
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)

    commands.add_parser("health", help="Check service readiness")

    store_parser = commands.add_parser("store", help="Store one or more facts")
    store_parser.add_argument("facts", nargs="+", help="Atomic facts to store")

    search_parser = commands.add_parser("search", help="Retrieve relevant facts")
    search_parser.add_argument("query", help="Semantic search query")
    search_parser.add_argument("--limit", type=int, help="Maximum results to return")

    delete_parser = commands.add_parser("delete", help="Delete a fact by UUID")
    delete_parser.add_argument("id", help="Fact UUID")

    return parser


def run(args: argparse.Namespace) -> object:
    """Execute the selected API command."""
    if args.command == "health":
        return request_json("GET", "/health", authenticated=False)

    if args.command == "store":
        return request_json("POST", "/facts", body={"facts": args.facts})

    if args.command == "search":
        body: dict[str, object] = {"query": args.query}
        if args.limit is not None:
            body["limit"] = args.limit
        return request_json("POST", "/search", body=body)

    if args.command == "delete":
        return request_json("DELETE", f"/facts/{quote(args.id, safe='')}")

    fail("command_error", f"Unsupported command: {args.command}")


def main() -> None:
    """Load configuration, execute a command, and print its JSON response."""
    load_env()
    print_json(run(create_parser().parse_args()))


if __name__ == "__main__":
    main()
