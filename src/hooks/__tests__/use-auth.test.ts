import { test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

test("isLoading starts as false", () => {
  const { result } = renderHook(() => useAuth());
  expect(result.current.isLoading).toBe(false);
});

test("exposes signIn and signUp functions", () => {
  const { result } = renderHook(() => useAuth());
  expect(typeof result.current.signIn).toBe("function");
  expect(typeof result.current.signUp).toBe("function");
});

// ---------------------------------------------------------------------------
// signIn – loading state
// ---------------------------------------------------------------------------

test("signIn sets isLoading to true while running", async () => {
  let resolveSignIn!: (v: any) => void;
  vi.mocked(signInAction).mockReturnValue(
    new Promise((res) => { resolveSignIn = res; })
  );

  const { result } = renderHook(() => useAuth());

  act(() => {
    result.current.signIn("user@example.com", "password123");
  });

  expect(result.current.isLoading).toBe(true);

  await act(async () => {
    resolveSignIn({ success: false, error: "Invalid credentials" });
  });

  expect(result.current.isLoading).toBe(false);
});

test("signIn resets isLoading to false after success", async () => {
  vi.mocked(signInAction).mockResolvedValue({ success: true });
  vi.mocked(getAnonWorkData).mockReturnValue(null);
  vi.mocked(getProjects).mockResolvedValue([{ id: "p1", name: "Project 1", createdAt: new Date(), updatedAt: new Date() }]);

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signIn("user@example.com", "password123");
  });

  expect(result.current.isLoading).toBe(false);
});

test("signIn resets isLoading even when signInAction throws", async () => {
  vi.mocked(signInAction).mockRejectedValue(new Error("Network error"));

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signIn("user@example.com", "password123").catch(() => {});
  });

  expect(result.current.isLoading).toBe(false);
});

// ---------------------------------------------------------------------------
// signIn – return value
// ---------------------------------------------------------------------------

test("signIn returns the result from the action", async () => {
  vi.mocked(signInAction).mockResolvedValue({ success: false, error: "Invalid credentials" });

  const { result } = renderHook(() => useAuth());

  let returnValue: any;
  await act(async () => {
    returnValue = await result.current.signIn("user@example.com", "wrongpassword");
  });

  expect(returnValue).toEqual({ success: false, error: "Invalid credentials" });
});

test("signIn calls signInAction with email and password", async () => {
  vi.mocked(signInAction).mockResolvedValue({ success: false });

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signIn("test@example.com", "mypassword");
  });

  expect(signInAction).toHaveBeenCalledWith("test@example.com", "mypassword");
});

// ---------------------------------------------------------------------------
// signIn – post sign-in: anon work promotion
// ---------------------------------------------------------------------------

test("signIn promotes anon work to a project when messages exist", async () => {
  const anonMessages = [{ role: "user", content: "Hello" }];
  const anonFileSystem = { "/App.jsx": "export default function App() {}" };

  vi.mocked(signInAction).mockResolvedValue({ success: true });
  vi.mocked(getAnonWorkData).mockReturnValue({
    messages: anonMessages,
    fileSystemData: anonFileSystem,
  });
  vi.mocked(createProject).mockResolvedValue({ id: "new-project-id" } as any);

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signIn("user@example.com", "password123");
  });

  expect(createProject).toHaveBeenCalledWith(
    expect.objectContaining({
      messages: anonMessages,
      data: anonFileSystem,
    })
  );
  expect(clearAnonWork).toHaveBeenCalledOnce();
  expect(mockPush).toHaveBeenCalledWith("/new-project-id");
});

test("signIn does not call getProjects when anon work is promoted", async () => {
  vi.mocked(signInAction).mockResolvedValue({ success: true });
  vi.mocked(getAnonWorkData).mockReturnValue({
    messages: [{ role: "user", content: "Hello" }],
    fileSystemData: {},
  });
  vi.mocked(createProject).mockResolvedValue({ id: "promo-id" } as any);

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signIn("user@example.com", "password123");
  });

  expect(getProjects).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// signIn – post sign-in: anon work with no messages (skips promotion)
// ---------------------------------------------------------------------------

test("signIn falls through to getProjects when anon work has no messages", async () => {
  vi.mocked(signInAction).mockResolvedValue({ success: true });
  vi.mocked(getAnonWorkData).mockReturnValue({ messages: [], fileSystemData: {} });
  vi.mocked(getProjects).mockResolvedValue([{ id: "existing-id", name: "Old Design", createdAt: new Date(), updatedAt: new Date() }]);

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signIn("user@example.com", "password123");
  });

  expect(createProject).not.toHaveBeenCalled();
  expect(clearAnonWork).not.toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith("/existing-id");
});

// ---------------------------------------------------------------------------
// signIn – post sign-in: no anon work, existing projects
// ---------------------------------------------------------------------------

test("signIn navigates to the most recent project when no anon work", async () => {
  vi.mocked(signInAction).mockResolvedValue({ success: true });
  vi.mocked(getAnonWorkData).mockReturnValue(null);
  vi.mocked(getProjects).mockResolvedValue([
    { id: "recent-id", name: "Recent Design", createdAt: new Date(), updatedAt: new Date() },
    { id: "older-id", name: "Old Design", createdAt: new Date(), updatedAt: new Date() },
  ]);

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signIn("user@example.com", "password123");
  });

  expect(mockPush).toHaveBeenCalledWith("/recent-id");
  expect(createProject).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// signIn – post sign-in: no anon work, no projects → creates new
// ---------------------------------------------------------------------------

test("signIn creates a new project when there are no existing projects", async () => {
  vi.mocked(signInAction).mockResolvedValue({ success: true });
  vi.mocked(getAnonWorkData).mockReturnValue(null);
  vi.mocked(getProjects).mockResolvedValue([]);
  vi.mocked(createProject).mockResolvedValue({ id: "brand-new-id" } as any);

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signIn("user@example.com", "password123");
  });

  expect(createProject).toHaveBeenCalledWith(
    expect.objectContaining({ messages: [], data: {} })
  );
  expect(mockPush).toHaveBeenCalledWith("/brand-new-id");
});

// ---------------------------------------------------------------------------
// signIn – failure: no post-sign-in side effects
// ---------------------------------------------------------------------------

test("signIn does not navigate when sign-in fails", async () => {
  vi.mocked(signInAction).mockResolvedValue({ success: false, error: "Invalid credentials" });

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signIn("user@example.com", "wrongpass");
  });

  expect(mockPush).not.toHaveBeenCalled();
  expect(getAnonWorkData).not.toHaveBeenCalled();
  expect(getProjects).not.toHaveBeenCalled();
  expect(createProject).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// signUp – loading state
// ---------------------------------------------------------------------------

test("signUp sets isLoading to true while running", async () => {
  let resolveSignUp!: (v: any) => void;
  vi.mocked(signUpAction).mockReturnValue(
    new Promise((res) => { resolveSignUp = res; })
  );

  const { result } = renderHook(() => useAuth());

  act(() => {
    result.current.signUp("new@example.com", "password123");
  });

  expect(result.current.isLoading).toBe(true);

  await act(async () => {
    resolveSignUp({ success: false });
  });

  expect(result.current.isLoading).toBe(false);
});

test("signUp resets isLoading even when signUpAction throws", async () => {
  vi.mocked(signUpAction).mockRejectedValue(new Error("Network error"));

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signUp("new@example.com", "password123").catch(() => {});
  });

  expect(result.current.isLoading).toBe(false);
});

// ---------------------------------------------------------------------------
// signUp – return value
// ---------------------------------------------------------------------------

test("signUp returns the result from the action", async () => {
  vi.mocked(signUpAction).mockResolvedValue({ success: false, error: "Email already registered" });

  const { result } = renderHook(() => useAuth());

  let returnValue: any;
  await act(async () => {
    returnValue = await result.current.signUp("existing@example.com", "password123");
  });

  expect(returnValue).toEqual({ success: false, error: "Email already registered" });
});

test("signUp calls signUpAction with email and password", async () => {
  vi.mocked(signUpAction).mockResolvedValue({ success: false });

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signUp("new@example.com", "securepassword");
  });

  expect(signUpAction).toHaveBeenCalledWith("new@example.com", "securepassword");
});

// ---------------------------------------------------------------------------
// signUp – post sign-in: same routing logic as signIn
// ---------------------------------------------------------------------------

test("signUp promotes anon work to a project when messages exist", async () => {
  const anonMessages = [{ role: "user", content: "Build me a button" }];
  const anonFileSystem = { "/App.jsx": "export default function App() {}" };

  vi.mocked(signUpAction).mockResolvedValue({ success: true });
  vi.mocked(getAnonWorkData).mockReturnValue({
    messages: anonMessages,
    fileSystemData: anonFileSystem,
  });
  vi.mocked(createProject).mockResolvedValue({ id: "signup-project-id" } as any);

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signUp("new@example.com", "password123");
  });

  expect(createProject).toHaveBeenCalledWith(
    expect.objectContaining({ messages: anonMessages, data: anonFileSystem })
  );
  expect(clearAnonWork).toHaveBeenCalledOnce();
  expect(mockPush).toHaveBeenCalledWith("/signup-project-id");
});

test("signUp navigates to most recent project when no anon work exists", async () => {
  vi.mocked(signUpAction).mockResolvedValue({ success: true });
  vi.mocked(getAnonWorkData).mockReturnValue(null);
  vi.mocked(getProjects).mockResolvedValue([{ id: "p1", name: "Design", createdAt: new Date(), updatedAt: new Date() }]);

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signUp("new@example.com", "password123");
  });

  expect(mockPush).toHaveBeenCalledWith("/p1");
});

test("signUp creates a new project when there are no existing projects", async () => {
  vi.mocked(signUpAction).mockResolvedValue({ success: true });
  vi.mocked(getAnonWorkData).mockReturnValue(null);
  vi.mocked(getProjects).mockResolvedValue([]);
  vi.mocked(createProject).mockResolvedValue({ id: "first-project-id" } as any);

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signUp("new@example.com", "password123");
  });

  expect(createProject).toHaveBeenCalledWith(
    expect.objectContaining({ messages: [], data: {} })
  );
  expect(mockPush).toHaveBeenCalledWith("/first-project-id");
});

test("signUp does not navigate when sign-up fails", async () => {
  vi.mocked(signUpAction).mockResolvedValue({ success: false, error: "Email already registered" });

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.signUp("existing@example.com", "password123");
  });

  expect(mockPush).not.toHaveBeenCalled();
  expect(getProjects).not.toHaveBeenCalled();
  expect(createProject).not.toHaveBeenCalled();
});
