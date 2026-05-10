import WebSocket, { type RawData } from "ws";
import type { AppConfig } from "../config/env";

export type RealtimeEvent =
  | { type: "mission.created"; payload: unknown }
  | { type: "mission.updated"; payload: unknown }
  | { type: "mission.deleted"; payload: { id: string } }
  | { type: "task.created"; payload: unknown }
  | { type: "task.updated"; payload: unknown }
  | { type: "payment.created"; payload: unknown }
  | { type: "agent.activity"; payload: { agent: string; message: string; ts: number } };

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
