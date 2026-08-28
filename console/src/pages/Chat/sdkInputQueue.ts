import {
  clearInputQueueState,
  migrateInputQueueState,
  type IAgentScopeRuntimeWebUIQueueOptions,
  type IAgentScopeRuntimeWebUIQueueRequestContext,
} from "@agentscope-ai/chat";
import type { ChatSessionIdentity } from "./sdkRequestSnapshot";

export const SDK_INPUT_QUEUE_MAX_SIZE = 50;

export function getSdkInputQueueScope(agentId: string): string {
  return `qwenpaw:${agentId || "default"}`;
}

export function getScopedSdkQueueSessionId(
  agentId: string,
  sessionId: string,
): string {
  return `${encodeURIComponent(getSdkInputQueueScope(agentId))}::${sessionId}`;
}

interface CreateSdkInputQueueOptions {
  agentId: string;
  getIdentity: () => ChatSessionIdentity;
  getBackendSessionId: (sessionId: string) => string | null | undefined;
  getSessionRunning: (
    sessionId: string,
    agentId: string,
  ) => boolean | Promise<boolean>;
  onFull: (maxSize: number) => void;
  onSessionNotReady: () => void;
}

/**
 * Keep CoPaw-specific Agent/session routing at the host boundary while the
 * SDK owns queue storage, cross-tab arbitration, retry and background drain.
 */
export function createSdkInputQueueOptions(
  options: CreateSdkInputQueueOptions,
): IAgentScopeRuntimeWebUIQueueOptions {
  const requestContext = (
    sessionId?: string,
  ): IAgentScopeRuntimeWebUIQueueRequestContext | undefined => {
    if (!sessionId) return undefined;
    const identity = options.getIdentity();
    const backendSessionId =
      options.getBackendSessionId(sessionId) || identity.sessionId || sessionId;
    return {
      session_id: backendSessionId,
      user_id: identity.userId,
      channel: identity.channel,
      agent_id: options.agentId,
      context: {
        session_id: backendSessionId,
        user_id: identity.userId,
        channel: identity.channel,
        agent_id: options.agentId,
      },
    };
  };

  return {
    enable: true,
    scope: getSdkInputQueueScope(options.agentId),
    maxSize: SDK_INPUT_QUEUE_MAX_SIZE,
    getSessionId: (sessionId) => sessionId,
    getRequestContext: requestContext,
    isSessionRunning: async ({ sessionId, requestContext: snapshot }) => {
      const backendSessionId = snapshot?.session_id || sessionId;
      // A blank new-chat screen has no session until its first message is
      // submitted. Treat that known pre-session state as idle so the SDK can
      // send directly and let the host create the conversation. Returning
      // true here makes the SDK try to enqueue the first message, but a queue
      // cannot exist before there is a session key.
      if (!backendSessionId) return false;
      try {
        return await options.getSessionRunning(
          backendSessionId,
          snapshot?.agent_id || options.agentId,
        );
      } catch {
        // Unknown runtime state must fail closed to avoid concurrent sends.
        return true;
      }
    },
    onFull: options.onFull,
    onSessionNotReady: options.onSessionNotReady,
  };
}

export function migrateSdkInputQueue(
  agentId: string,
  fromSessionId: string,
  toSessionId: string,
): Promise<void> {
  return migrateInputQueueState(
    getScopedSdkQueueSessionId(agentId, fromSessionId),
    getScopedSdkQueueSessionId(agentId, toSessionId),
  );
}

export function clearSdkInputQueue(agentId: string, sessionId: string): void {
  clearInputQueueState(getScopedSdkQueueSessionId(agentId, sessionId));
}
