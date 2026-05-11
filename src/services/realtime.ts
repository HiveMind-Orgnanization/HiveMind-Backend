import WebSocket, { type RawData } from "ws";
import type { AppConfig } from "../config/env";

/** Notification payload shape consumed by the frontend NotificationsContext. The provider
 *  reads `title`/`body`/`agent`/`missionId`/`amount` directly off the payload. */
export type NotificationPayload = {
  title: string;
  body: string;
  agent?: string;
  missionId?: string;
  amount?: string;
  ts?: number;
};

export type RealtimeEvent =
  | { type: "mission.created"; payload: unknown }
  | { type: "mission.updated"; payload: unknown }
  | { type: "mission.deleted"; payload: { id: string } }
  | { type: "mission.completed"; payload: NotificationPayload }
  | { type: "mission.failed"; payload: NotificationPayload }
  | { type: "mission.trial_activated"; payload: NotificationPayload }
  | { type: "task.created"; payload: unknown }
  | { type: "task.updated"; payload: unknown }
  | { type: "payment.created"; payload: unknown }
  | { type: "payment.settled"; payload: NotificationPayload }
  | { type: "payment.trial_used"; payload: NotificationPayload }
  | { type: "payment.wallet_funded"; payload: NotificationPayload }
  | { type: "execution.checkpoint"; payload: NotificationPayload }
  | { type: "execution.error"; payload: NotificationPayload }
  | { type: "agent.activity"; payload: { agent: string; message: string; ts: number } };

/** Build a NotificationPayload with `ts` defaulted to now. */
export function notif(p: Omit<NotificationPayload, "ts"> & { ts?: number }): NotificationPayload {
  return { ts: Date.now(), ...p };
}

type Client = { socket: WebSocket; channels: Set<string> };

export class RealtimeHub {
  private clients = new Set<Client>();

  add(socket: WebSocket) {
    const c: Client = { socket, channels: new Set(["global"]) };
    this.clients.add(c);
    socket.on("close", () => this.clients.delete(c));
    socket.on("message", (raw: RawData) => {
      try {
        const msg = JSON.parse(String(raw)) as { action?: string; channel?: string };
        if (msg.action === "subscribe" && msg.channel) c.channels.add(msg.channel);
        if (msg.action === "unsubscribe" && msg.channel) c.channels.delete(msg.channel);
      } catch {
        /* ignore */
      }
    });
    return c;
  }

  broadcast(event: RealtimeEvent, channel = "global") {
    const line = JSON.stringify(event);
    for (const c of this.clients) {
      if (!c.channels.has(channel) && !c.channels.has("global")) continue;
      if (c.socket.readyState === 1) c.socket.send(line);
    }
  }

  pingAgentsDemo() {
    const agents = ["Strategy", "Research", "Design", "Treasury", "Coordination"];
    const pick = () => agents[Math.floor(Math.random() * agents.length)];
    this.broadcast(
      {
        type: "agent.activity",
        payload: {
          agent: pick(),
          message: "heartbeat · orchestration nominal",
          ts: Date.now(),
        },
      },
      "global"
    );
  }
}

export function attachDemoPulse(hub: RealtimeHub, cfg: AppConfig) {
  if (cfg.NODE_ENV === "test") return () => {};
  if (!cfg.DEMO_PULSE) return () => {};
  const id = setInterval(() => hub.pingAgentsDemo(), 4000);
  return () => clearInterval(id);
}
