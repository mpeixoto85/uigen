// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT, jwtVerify } from "jose";

// Must mock before importing auth
vi.mock("server-only", () => ({}));

const mockGet = vi.fn();
const mockSet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({ get: mockGet, set: mockSet })),
}));

// Import after mocks are set up
const { getSession, createSession } = await import("@/lib/auth");

const SECRET = Buffer.from("development-secret-key");

async function makeToken(
  payload: Record<string, unknown>,
  expiresIn = "7d"
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(SECRET);
}

describe("createSession", () => {
  beforeEach(() => {
    mockSet.mockReset();
    (process.env as any).NODE_ENV = undefined;
  });

  it("sets the auth-token cookie", async () => {
    await createSession("user_1", "user@example.com");
    expect(mockSet).toHaveBeenCalledOnce();
    expect(mockSet.mock.calls[0][0]).toBe("auth-token");
  });

  it("JWT payload contains userId and email", async () => {
    await createSession("user_42", "alice@example.com");
    const token = mockSet.mock.calls[0][1] as string;
    const { payload } = await jwtVerify(token, SECRET);
    expect(payload.userId).toBe("user_42");
    expect(payload.email).toBe("alice@example.com");
  });

  it("cookie is httpOnly", async () => {
    await createSession("user_1", "user@example.com");
    const options = mockSet.mock.calls[0][2] as Record<string, unknown>;
    expect(options.httpOnly).toBe(true);
  });

  it("cookie has sameSite lax and path /", async () => {
    await createSession("user_1", "user@example.com");
    const options = mockSet.mock.calls[0][2] as Record<string, unknown>;
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  it("cookie is not secure outside production", async () => {
    (process.env as any).NODE_ENV = "test";
    await createSession("user_1", "user@example.com");
    const options = mockSet.mock.calls[0][2] as Record<string, unknown>;
    expect(options.secure).toBe(false);
  });

  it("cookie is secure in production", async () => {
    (process.env as any).NODE_ENV = "production";
    await createSession("user_1", "user@example.com");
    const options = mockSet.mock.calls[0][2] as Record<string, unknown>;
    expect(options.secure).toBe(true);
  });

  it("cookie expires approximately 7 days from now", async () => {
    const before = Date.now();
    await createSession("user_1", "user@example.com");
    const after = Date.now();
    const options = mockSet.mock.calls[0][2] as Record<string, unknown>;
    const expires = (options.expires as Date).getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(expires).toBeGreaterThanOrEqual(before + sevenDays - 1000);
    expect(expires).toBeLessThanOrEqual(after + sevenDays + 1000);
  });
});

describe("getSession", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("returns null when no cookie is present", async () => {
    mockGet.mockReturnValue(undefined);
    const session = await getSession();
    expect(session).toBeNull();
  });

  it("returns null when cookie value is empty string", async () => {
    mockGet.mockReturnValue({ value: "" });
    const session = await getSession();
    expect(session).toBeNull();
  });

  it("returns null when token is invalid", async () => {
    mockGet.mockReturnValue({ value: "not.a.valid.jwt" });
    const session = await getSession();
    expect(session).toBeNull();
  });

  it("returns null when token is expired", async () => {
    const token = await makeToken(
      { userId: "user_1", email: "test@example.com", expiresAt: new Date() },
      "-1s" // already expired
    );
    mockGet.mockReturnValue({ value: token });
    const session = await getSession();
    expect(session).toBeNull();
  });

  it("returns the session payload for a valid token", async () => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const token = await makeToken({
      userId: "user_123",
      email: "hello@example.com",
      expiresAt: expiresAt.toISOString(),
    });
    mockGet.mockReturnValue({ value: token });

    const session = await getSession();

    expect(session).not.toBeNull();
    expect(session?.userId).toBe("user_123");
    expect(session?.email).toBe("hello@example.com");
  });

  it("returns null when token is signed with a different secret", async () => {
    const wrongSecret = Buffer.from("wrong-secret");
    const token = await new SignJWT({ userId: "user_1", email: "a@b.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(wrongSecret);

    mockGet.mockReturnValue({ value: token });
    const session = await getSession();
    expect(session).toBeNull();
  });
});
