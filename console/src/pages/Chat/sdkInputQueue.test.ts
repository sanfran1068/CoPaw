import { describe, expect, it, vi } from "vitest";
import {
  createSdkInputQueueOptions,
  getScopedSdkQueueSessionId,
  getSdkInputQueueScope,
} from "./sdkInputQueue";

describe("CoPaw SDK input queue adapter", () => {
  it("uses an Agent-scoped namespace", () => {
    expect(getSdkInputQueueScope("agent-a")).toBe("qwenpaw:agent-a");
    expect(getScopedSdkQueueSessionId("agent-a", "chat-1")).toBe(
      "qwenpaw%3Aagent-a::chat-1",
    );
  });

  it("freezes backend route identity at enqueue time", () => {
    const queue = createSdkInputQueueOptions({
      agentId: "agent-a",
      getIdentity: () => ({
        sessionId: "identity-session",
        userId: "user-a",
        channel: "console",
      }),
      getBackendSessionId: () => "backend-session",
      getSessionRunning: () => false,
      onFull: vi.fn(),
      onSessionNotReady: vi.fn(),
    });

    expect(queue.getRequestContext?.("local-session")).toEqual({
      session_id: "backend-session",
      user_id: "user-a",
      channel: "console",
      agent_id: "agent-a",
      context: {
        session_id: "backend-session",
        user_id: "user-a",
        channel: "console",
        agent_id: "agent-a",
      },
    });
  });

  it("fails closed when runtime state cannot be determined", async () => {
    const queue = createSdkInputQueueOptions({
      agentId: "agent-a",
      getIdentity: () => ({}),
      getBackendSessionId: () => null,
      getSessionRunning: () => Promise.reject(new Error("offline")),
      onFull: vi.fn(),
      onSessionNotReady: vi.fn(),
    });

    await expect(
      queue.isSessionRunning?.({
        sessionId: "chat-1",
        queueSessionId: "scoped::chat-1",
      }),
    ).resolves.toBe(true);
  });
});
