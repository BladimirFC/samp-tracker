export const runtime = "nodejs";

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function verifyEd25519(
  signature: string,
  timestamp: string,
  body: string,
  publicKey: string
): Promise<boolean> {
  try {
    const nacl = (await import("tweetnacl")).default;
    const msg = new TextEncoder().encode(timestamp + body);
    const sigBytes = hexToBytes(signature);
    const keyBytes = hexToBytes(publicKey);
    return nacl.sign.detached.verify(msg, sigBytes, keyBytes);
  } catch {
    return false;
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const publicKey = process.env.DISCORD_PUBLIC_KEY || "";

  try {
    const rawBody = await req.text();
    const sig = req.headers.get("x-signature-ed25519") || "";
    const ts = req.headers.get("x-signature-timestamp") || "";

    if (publicKey && sig && ts) {
      const valid = await verifyEd25519(sig, ts, rawBody, publicKey);
      if (!valid) {
        return Response.json({ error: "Invalid request signature" }, { status: 401 });
      }
    }

    const interaction = JSON.parse(rawBody);

    // PING (type 1) — respond with PONG
    if (interaction.type === 1) {
      return Response.json({ type: 1 });
    }

    // SLASH COMMAND: /report (type 2)
    if (interaction.type === 2 && interaction.data?.name === "report") {
      return Response.json({
        type: 9,
        data: {
          custom_id: "report_modal",
          title: "Nuevo Reporte",
          components: [
            { type: 1, components: [
              { type: 4, custom_id: "title", label: "Título del reporte", style: 1, placeholder: "Ej: Error al abrir el menú de trabajo", required: true, max_length: 100 },
            ]},
            { type: 1, components: [
              { type: 4, custom_id: "type", label: "Tipo (Bug, Exploit, Sugerencia, Optimización, Mejora)", style: 1, placeholder: "Bug", required: true, value: "Bug", max_length: 20 },
            ]},
            { type: 1, components: [
              { type: 4, custom_id: "priority", label: "Prioridad (Crítica, Alta, Media, Baja)", style: 1, placeholder: "Media", required: true, value: "Media", max_length: 10 },
            ]},
            { type: 1, components: [
              { type: 4, custom_id: "description", label: "Descripción del problema", style: 2, placeholder: "Describe el bug con detalle...", required: true, max_length: 1000 },
            ]},
          ],
        },
      });
    }

    // MODAL SUBMIT (type 5)
    if (interaction.type === 5 && interaction.data?.custom_id === "report_modal") {
      const getVal = (id: string) => {
        for (const row of interaction.data.components) {
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

      const trackerUrl = process.env.TRACKER_URL || "https://samp-tracker.vercel.app";
      const apiSecret = process.env.TRACKER_API_SECRET || "legacy-roleplay";

      try {
        const res = await fetch(`${trackerUrl}/api?apipath=reports`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiSecret}`,
          },
          body: JSON.stringify({ title, type, priority, description, author }),
        });
        const result = await res.json() as { id?: string; error?: string };

        if (result.id) {
          return Response.json({
            type: 4,
            data: {
              content: `✅ **Reporte creado**\n\n**${result.id}** — ${title}\nTipo: ${type} | Prioridad: ${priority}\n\n🔗 [Ver en el tracker](${trackerUrl})`,
            },
          });
        } else {
          return Response.json({
            type: 64,
            data: {
              content: `❌ Error: ${result.error || "No se pudo crear el reporte"}`,
            },
          });
        }
      } catch (e) {
        return Response.json({
          type: 64,
          data: {
            content: `❌ Error del servidor: ${e instanceof Error ? e.message : "Unknown"}`,
          },
        });
      }
    }

    return Response.json({ type: 4, data: { content: "Comando no reconocido." } });
  } catch (e) {
    return Response.json(
      { type: 4, data: { content: "Error interno del bot" } },
      { status: 200 }
    );
  }
}
