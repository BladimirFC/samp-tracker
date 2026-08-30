export const runtime = "nodejs";
import { createPublicKey, createVerify } from "node:crypto";

// ─── DISCORD CONFIG ───────────────────────────────────────────────

function getConfig() {
  return {
    applicationId: process.env.DISCORD_APP_ID || "",
    botToken: process.env.DISCORD_BOT_TOKEN || "",
    publicKey: process.env.DISCORD_PUBLIC_KEY || "",
    trackerUrl: process.env.TRACKER_URL || "https://samp-tracker.vercel.app",
    apiSecret: process.env.TRACKER_API_SECRET || "legacy-roleplay",
  };
}

// ─── SIGNATURE VERIFICATION ───────────────────────────────────────

function hexToUint8Array(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return arr;
}

function verifySignature(
  signature: string,
  timestamp: string,
  body: string,
  publicKey: string
): boolean {
  try {
    const message = Buffer.from(timestamp + body);
    const sig = Buffer.from(signature, "hex");
    const key = `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;
    const verifier = createVerify("sha256");
    verifier.update(message);
    return verifier.verify(key, sig);
  } catch {
    return false;
  }
}

// ─── DISCORD API HELPERS ──────────────────────────────────────────

async function discordAPI(endpoint: string, method = "GET", body?: unknown) {
  const config = getConfig();
  const res = await fetch(`https://discord.com/api/v10${endpoint}`, {
    method,
    headers: {
      Authorization: `Bot ${config.botToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// ─── CREATE REPORT (via internal API) ─────────────────────────────

async function createReport(title: string, type: string, priority: string, description: string, author: string) {
  const config = getConfig();
  const res = await fetch(`${config.trackerUrl}/api?apipath=reports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiSecret}`,
    },
    body: JSON.stringify({ title, type, priority, description, author }),
  });
  return res.json();
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const config = getConfig();
  if (!config.publicKey) {
    return new Response("Discord not configured", { status: 500 });
  }

  // Verify signature
  const signature = req.headers.get("x-signature-ed25519") || "";
  const timestamp = req.headers.get("x-signature-timestamp") || "";
  const body = await req.text();

  if (!verifySignature(signature, timestamp, body, config.publicKey)) {
    return new Response("Invalid request", { status: 401 });
  }

  const interaction = JSON.parse(body);

  // ── PING ──
  if (interaction.type === 1) {
    return Response.json({ type: 1 });
  }

  // ── SLASH COMMAND ──
  if (interaction.type === 2) {
    const { name, options } = interaction.data;

    // /report - show modal
    if (name === "report") {
      return Response.json({
        type: 9, // MODAL
        data: {
          custom_id: "report_modal",
          title: "Nuevo Reporte",
          components: [
            {
              type: 1, // ACTION_ROW
              components: [
                {
                  type: 4, // TEXT_INPUT
                  custom_id: "title",
                  label: "Título del reporte",
                  style: 1, // SHORT
                  placeholder: "Ej: Error al abrir el menú de trabajo",
                  required: true,
                  max_length: 100,
                },
              ],
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "type",
                  label: "Tipo (Bug, Exploit, Sugerencia, Optimización, Mejora)",
                  style: 1,
                  placeholder: "Bug",
                  required: true,
                  value: "Bug",
                  max_length: 20,
                },
              ],
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "priority",
                  label: "Prioridad (Crítica, Alta, Media, Baja)",
                  style: 1,
                  placeholder: "Media",
                  required: true,
                  value: "Media",
                  max_length: 10,
                },
              ],
            },
            {
              type: 1,
              components: [
                {
                  type: 4, // TEXT_INPUT
                  custom_id: "description",
                  label: "Descripción del problema",
                  style: 2, // PARAGRAPH
                  placeholder: "Describe el bug con detalle...",
                  required: true,
                  max_length: 1000,
                },
              ],
            },
          ],
        },
      });
    }

    return Response.json({ type: 4, data: { content: "Comando no reconocido." } });
  }

  // ── MODAL SUBMIT ──
  if (interaction.type === 5) {
    const { custom_id, components } = interaction.data;

    if (custom_id === "report_modal") {
      const getVal = (id: string) => {
        for (const row of components) {
          for (const comp of row.components) {
            if (comp.custom_id === id) return comp.value || "";
          }
        }
        return "";
      };

      const title = getVal("title");
      const type = getVal("type");
      const priority = getVal("priority");
      const description = getVal("description");
      const author = interaction.member?.user?.username || interaction.user?.username || "Discord";

      try {
        const result = await createReport(title, type, priority, description, author);

        if (result.id) {
          return Response.json({
            type: 4,
            data: {
              content: `✅ **Reporte creado**\n\n**${result.id}** — ${title}\nTipo: ${type} | Prioridad: ${priority}\n\n🔗 [Ver en el tracker](${getConfig().trackerUrl})`,
              flags: 0, // PUBLIC (visible for everyone)
            },
          });
        } else {
          return Response.json({
            type: 4,
            data: {
              content: `❌ Error: ${result.error || "No se pudo crear el reporte"}`,
              flags: 64, // EPHEMERAL (only visible to user)
            },
          });
        }
      } catch (e) {
        return Response.json({
          type: 4,
          data: {
            content: `❌ Error del servidor: ${e instanceof Error ? e.message : "Unknown"}`,
            flags: 64,
          },
        });
      }
    }
  }

  return Response.json({ type: 4, data: { content: "Unknown interaction" } });
}
