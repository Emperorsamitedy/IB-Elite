import "server-only";
import Pusher from "pusher";
import type { LadderPublisher, ProgressEvent } from "./types";

function readConfig() {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;
  if (!appId || !key || !secret || !cluster) return null;
  return { appId, key, secret, cluster, useTLS: true };
}

export function isPusherConfigured(): boolean {
  return readConfig() !== null;
}

/**
 * Server-side Pusher publisher. Credentials come from the environment only.
 */
export function createPusherPublisher(): LadderPublisher {
  const config = readConfig();
  if (!config) {
    throw new Error(
      "Pusher is not configured. Set PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET and PUSHER_CLUSTER.",
    );
  }
  const client = new Pusher(config);
  return {
    async publish(channel: string, event: string, payload: ProgressEvent) {
      await client.trigger(channel, event, payload);
    },
  };
}

/** Silently drops events; opponents fall back to polling. */
const NOOP_PUBLISHER: LadderPublisher = {
  async publish() {},
};

/**
 * The publisher for API routes: real Pusher when configured, otherwise a
 * no-op so the ladder still works (via polling) on installs without keys.
 */
export function createPublisher(): LadderPublisher {
  return isPusherConfigured() ? createPusherPublisher() : NOOP_PUBLISHER;
}
