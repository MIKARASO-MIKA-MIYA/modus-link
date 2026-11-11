import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { assertOrigin, ok, publicRoute } from "@/server/http";

const production = "https://modus-link.vercel.app";
const deployment = "https://modus-link-abc123-team.vercel.app";
const branch = "https://modus-link-git-main-team.vercel.app";

function request(origin?: string, method = "POST", headers = {}) {
  return new NextRequest(`${production}/api/v1/auth/register`, {
    method,
    headers: { ...headers, ...(origin === undefined ? {} : { Origin: origin }) },
  });
}

function vercel() {
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("VERCEL_URL", new URL(deployment).host);
  vi.stubEnv("VERCEL_BRANCH_URL", new URL(branch).host);
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", new URL(production).host);
}

beforeEach(() => {
  for (const key of [
    "APP_ORIGIN",
    "VERCEL",
    "VERCEL_URL",
    "VERCEL_BRANCH_URL",
    "VERCEL_PROJECT_PRODUCTION_URL",
  ]) vi.stubEnv(key, undefined);
  vi.stubEnv("NODE_ENV", "production");
});
afterEach(() => vi.unstubAllEnvs());

describe("Origin protection on Vercel", () => {
  it.each([undefined, "http://localhost:3000", "invalid-origin"])(
    "accepts this project's deployment URLs with APP_ORIGIN=%s",
    (appOrigin) => {
      vercel();
      vi.stubEnv("APP_ORIGIN", appOrigin);
      for (const origin of [production, deployment, branch])
        expect(() => assertOrigin(request(origin))).not.toThrow();
    },
  );

  it("also accepts an explicitly configured custom domain", () => {
    vercel();
    vi.stubEnv("APP_ORIGIN", "https://feedback.example.com/");
    expect(() => assertOrigin(request("https://feedback.example.com"))).not.toThrow();
    expect(() => assertOrigin(request(deployment))).not.toThrow();
  });

  it.each([
    undefined,
    "null",
    "https://evil.example",
    "https://another-project.vercel.app",
    "https://modus-link.vercel.app.evil.example",
    "http://modus-link.vercel.app",
    "https://modus-link.vercel.app:444",
    "http://localhost:3000",
  ])("rejects an untrusted or missing Origin: %s", (origin) => {
    vercel();
    expect(() => assertOrigin(request(origin))).toThrow(
      expect.objectContaining({ status: 403, code: "INVALID_ORIGIN" }),
    );
  });

  it("does not trust the request URL or forwarded host headers", () => {
    vercel();
    const forged = new NextRequest("https://evil.example/api/v1/auth/register", {
      method: "POST",
      headers: {
        Origin: "https://evil.example",
        Host: "evil.example",
        "X-Forwarded-Host": "evil.example",
        "X-Forwarded-Proto": "https",
      },
    });
    expect(() => assertOrigin(forged)).toThrow();
  });

  it("passes allowed requests to the handler and blocks others before execution", async () => {
    vercel();
    const action = vi.fn(async () => ok({ accepted: true }, 201));
    const accepted = await publicRoute(request(production), action);
    expect(accepted.status).toBe(201);
    expect(await accepted.json()).toEqual({ data: { accepted: true } });
    expect(accepted.headers.get("X-Request-Id")).toBeTruthy();
    action.mockClear();
    const rejected = await publicRoute(request("https://evil.example"), action);
    expect(rejected.status).toBe(403);
    expect(await rejected.json()).toMatchObject({ error: { code: "INVALID_ORIGIN" } });
    expect(action).not.toHaveBeenCalled();
  });
});

describe("Origin protection outside Vercel", () => {
  it("keeps explicit APP_ORIGIN matching, including the port", () => {
    vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3100/");
    expect(() => assertOrigin(request("http://127.0.0.1:3100"))).not.toThrow();
    expect(() => assertOrigin(request("http://127.0.0.1:3000"))).toThrow();
  });

  it("defaults to localhost only in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(() => assertOrigin(request("http://localhost:3000"))).not.toThrow();
    vi.stubEnv("NODE_ENV", "production");
    expect(() => assertOrigin(request("http://localhost:3000"))).toThrow();
  });

  it.each([undefined, "invalid-origin", "data:text/plain,hello"])(
    "fails closed without a valid production origin: %s",
    (appOrigin) => {
      vi.stubEnv("APP_ORIGIN", appOrigin);
      expect(() => assertOrigin(request(production))).toThrow();
      expect(() => assertOrigin(request("null"))).toThrow();
    },
  );

  it("ignores deployment metadata outside Vercel", () => {
    vercel();
    vi.stubEnv("VERCEL", undefined);
    vi.stubEnv("APP_ORIGIN", "https://feedback.example.com");
    expect(() => assertOrigin(request(production))).toThrow();
  });

  it.each(["GET", "HEAD", "OPTIONS"])("allows %s without Origin", (method) => {
    expect(() => assertOrigin(request(undefined, method))).not.toThrow();
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])("requires Origin for %s", (method) => {
    vi.stubEnv("APP_ORIGIN", production);
    expect(() => assertOrigin(request(undefined, method))).toThrow();
  });
});
