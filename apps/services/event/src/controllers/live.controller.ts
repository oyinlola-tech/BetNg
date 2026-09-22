// A client can subscribe, unsubscribe, answer a heartbeat and authenticate; there is no frame that publishes.
// Private channels need a session identity resolves, re-checked on every subscribe and on a timer.

import { createHash, timingSafeEqual } from "node:crypto";
import { clientFrameSchema, ErrorCodes } from "@betng/contracts";
import type { ServerFrame } from "@betng/contracts";
import type { Logger, WebSocketSession } from "@betng/service-kit";
import type { QueryBus } from "@zudojs/cqrs";
import { validate, z } from "@zudojs/validation";
import { channelRule, isPrivate, mayRead } from "../access/index.js";
import type { ResolvedSession, SessionAuthenticator } from "../clients/index.js";
import type { LiveSettings } from "../configs/index.js";
import type { ChannelRegistry, ChannelState } from "../interfaces/index.js";
import { GetChannelStateQuery } from "../services/event/queries/index.js";

const TOKEN = /^[A-Za-z0-9._~+/=-]{16,512}$/;

const authFrameSchema = z.object({ type: z.literal("AUTH"), token: z.string().regex(TOKEN) });

export interface LiveControllerOptions {
  readonly channels: ChannelRegistry;
  readonly queryBus: QueryBus;
  readonly logger: Logger;
  readonly authenticator: SessionAuthenticator;
  readonly settings: LiveSettings;
  readonly now?: () => number;
}

export interface ConnectionInfo {
  readonly address: string;
  readonly token?: string;
}

export interface RevokeRequest {
  readonly tokenHash?: string;
  readonly userId?: string;
}

export interface LiveController {
  onConnection(session: WebSocketSession, info: ConnectionInfo): void;
  onMessage(session: WebSocketSession, data: string): Promise<void>;
  onClose(session: WebSocketSession): void;
  revalidate(): Promise<void>;
  revoke(request: RevokeRequest): number;
}

interface SessionState {
  token?: string;
  tokenHash?: string;
  resolved?: ResolvedSession;
  authAttempts: number;
  frames: number;
  windowStart: number;
  queue: Promise<void>;
}

type AuthFailure = "UNAUTHENTICATED" | "SESSION_EXPIRED";

function send(session: WebSocketSession, frame: ServerFrame): void {
  session.send(JSON.stringify(frame));
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function sameHash(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);

  return a.length === b.length && timingSafeEqual(a, b);
}

export function createLiveController(options: LiveControllerOptions): LiveController {
  const { channels, queryBus, logger, authenticator, settings } = options;
  const now = options.now ?? Date.now;
  const states = new Map<WebSocketSession, SessionState>();

  function reject(session: WebSocketSession, code: string, message: string): void {
    send(session, { type: "ERROR", code, message });
  }

  function requestId(session: WebSocketSession): string {
    return `live-${session.id}`;
  }

  function dropPrivate(session: WebSocketSession, keep?: (channel: string) => boolean): void {
    for (const channel of channels.subscriptions(session)) {
      if (isPrivate(channel) && keep?.(channel) !== true) {
        channels.unsubscribe(session, channel);
        send(session, { type: "UNSUBSCRIBED", channel });
      }
    }
  }

  function signOut(session: WebSocketSession, state: SessionState, code: AuthFailure): void {
    delete state.token;
    delete state.tokenHash;
    delete state.resolved;
    dropPrivate(session);
    reject(
      session,
      code,
      code === "SESSION_EXPIRED" ? "Your session has ended. Sign in again." : "Sign in to receive account updates.",
    );
  }

  function enqueue(session: WebSocketSession, state: SessionState, job: () => Promise<void>): Promise<void> {
    state.queue = state.queue.then(job).catch((error: unknown) => {
      logger.warn("Live frame failed", {
        connectionId: session.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return state.queue;
  }

  async function authenticate(session: WebSocketSession, state: SessionState, token: string): Promise<void> {
    state.authAttempts += 1;

    if (state.authAttempts > settings.maxAuthAttempts) {
      reject(session, ErrorCodes.RATE_LIMITED, "Too many sign-in attempts on this connection.");
      session.close(1008, "Too many sign-in attempts");
      return;
    }

    if (state.token !== undefined && state.token !== token) {
      dropPrivate(session);
      delete state.resolved;
    }

    state.token = token;
    state.tokenHash = hashToken(token);

    const outcome = await authenticator.authenticate(token, requestId(session));

    if (!states.has(session)) return;

    if (outcome.ok) {
      state.resolved = outcome.session;
      return;
    }

    if (outcome.reason === "UNAVAILABLE") {
      reject(session, ErrorCodes.UPSTREAM_UNAVAILABLE, "Account updates are unavailable right now.");
      return;
    }

    signOut(session, state, outcome.reason);
  }

  async function subscribe(session: WebSocketSession, state: SessionState, channel: string): Promise<void> {
    const rule = channelRule(channel);

    if (rule === undefined) {
      reject(session, ErrorCodes.NOT_FOUND, "That is not a channel this service serves.");
      return;
    }

    const current = channels.subscriptions(session);

    if (!current.includes(channel) && current.length >= settings.maxChannelsPerConnection) {
      reject(session, ErrorCodes.RATE_LIMITED, "Too many channels on this connection.");
      return;
    }

    if (rule.type !== "public") {
      if (state.token === undefined) {
        reject(session, ErrorCodes.UNAUTHENTICATED, "Sign in to receive account updates.");
        return;
      }

      const outcome = await authenticator.authenticate(state.token, requestId(session));

      if (!states.has(session)) return;

      if (!outcome.ok) {
        if (outcome.reason === "UNAVAILABLE") {
          reject(session, ErrorCodes.UPSTREAM_UNAVAILABLE, "Account updates are unavailable right now.");
        } else {
          signOut(session, state, outcome.reason);
        }

        return;
      }

      state.resolved = outcome.session;

      if (!mayRead(rule, outcome.session.actor)) {
        reject(session, ErrorCodes.FORBIDDEN, "You cannot subscribe to that channel.");
        return;
      }
    }

    channels.subscribe(session, channel);

    const snapshot = await queryBus.execute<GetChannelStateQuery, ChannelState>(new GetChannelStateQuery(channel));

    send(session, { type: "SUBSCRIBED", channel, lastSequence: snapshot.lastSequence });
  }

  function overRate(state: SessionState): boolean {
    const at = now();

    if (at - state.windowStart >= settings.frameWindowMs) {
      state.windowStart = at;
      state.frames = 0;
    }

    state.frames += 1;

    return state.frames > settings.maxFramesPerWindow;
  }

  async function revalidateOne(session: WebSocketSession, state: SessionState): Promise<void> {
    const token = state.token;

    if (token === undefined) return;

    if (state.resolved !== undefined && state.resolved.expiresAt <= now()) {
      signOut(session, state, "SESSION_EXPIRED");
      return;
    }

    const outcome = await authenticator.authenticate(token, requestId(session));

    if (!states.has(session) || state.token !== token) return;

    if (outcome.ok) {
      state.resolved = outcome.session;
      dropPrivate(session, (channel) => {
        const rule = channelRule(channel);

        return rule !== undefined && mayRead(rule, outcome.session.actor);
      });
      return;
    }

    if (outcome.reason === "UNAVAILABLE") {
      delete state.resolved;

      if (channels.subscriptions(session).some(isPrivate)) {
        dropPrivate(session);
        reject(session, ErrorCodes.UPSTREAM_UNAVAILABLE, "Account updates paused; subscribe again shortly.");
      }

      return;
    }

    signOut(session, state, outcome.reason);
  }

  return {
    onConnection: (session, info) => {
      const state: SessionState = { authAttempts: 0, frames: 0, windowStart: now(), queue: Promise.resolve() };

      states.set(session, state);
      channels.open(session);

      send(session, { type: "WELCOME", connectionId: session.id, serverTime: new Date(now()).toISOString() });

      const token = info.token;

      if (token !== undefined) {
        if (TOKEN.test(token)) {
          void enqueue(session, state, () => authenticate(session, state, token));
        } else {
          reject(session, ErrorCodes.UNAUTHENTICATED, "The access token is not valid.");
        }
      }

      logger.info("Live client connected", { connectionId: session.id });
    },

    onMessage: async (session, data) => {
      const state = states.get(session);

      if (state === undefined) return;

      if (overRate(state)) {
        reject(session, ErrorCodes.RATE_LIMITED, "Too many frames.");
        session.close(1008, "Too many frames");
        return;
      }

      let parsed: unknown;

      try {
        parsed = JSON.parse(data);
      } catch {
        reject(session, ErrorCodes.VALIDATION_FAILED, "The frame is not valid JSON.");
        return;
      }

      if (typeof parsed === "object" && parsed !== null && (parsed as { type?: unknown }).type === "AUTH") {
        const auth = validate(authFrameSchema, parsed);

        if (!auth.success) {
          reject(session, ErrorCodes.UNAUTHENTICATED, "The access token is not valid.");
          return;
        }

        return enqueue(session, state, () => authenticate(session, state, auth.data.token));
      }

      const result = validate(clientFrameSchema, parsed);

      if (!result.success) {
        reject(
          session,
          ErrorCodes.VALIDATION_FAILED,
          "The frame is not one this protocol defines. A client may send AUTH, SUBSCRIBE, UNSUBSCRIBE or PONG.",
        );
        return;
      }

      const frame = result.data;

      switch (frame.type) {
        case "SUBSCRIBE":
          return enqueue(session, state, () => subscribe(session, state, frame.channel));

        case "UNSUBSCRIBE":
          return enqueue(session, state, () => {
            channels.unsubscribe(session, frame.channel);
            send(session, { type: "UNSUBSCRIBED", channel: frame.channel });

            return Promise.resolve();
          });

        case "PONG":
          channels.markAlive(session);
          return;
      }
    },

    onClose: (session) => {
      states.delete(session);
      channels.close(session);
      logger.info("Live client disconnected", { connectionId: session.id });
    },

    revalidate: async () => {
      const pending = [...states.entries()].filter(([, state]) => state.token !== undefined);

      for (let index = 0; index < pending.length; index += 50) {
        await Promise.allSettled(
          pending
            .slice(index, index + 50)
            .map(([session, state]) => enqueue(session, state, () => revalidateOne(session, state))),
        );
      }
    },

    revoke: (request) => {
      let revoked = 0;

      for (const [session, state] of states) {
        const byHash =
          request.tokenHash !== undefined && state.tokenHash !== undefined && sameHash(state.tokenHash, request.tokenHash);
        const byUser =
          request.userId !== undefined && state.resolved?.actor.id.toLowerCase() === request.userId.toLowerCase();

        if (byHash || byUser) {
          signOut(session, state, "SESSION_EXPIRED");
          revoked += 1;
        }
      }

      return revoked;
    },
  };
}
