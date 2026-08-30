export const runtime = "nodejs";

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.text();
    const interaction = JSON.parse(body);

    // PING - respond with PONG
    if (interaction.type === 1) {
      return Response.json({ type: 1 });
    }

    return Response.json({ type: 4, data: { content: "Bot connected!" } });
  } catch (e) {
    return Response.json({ type: 4, data: { content: "Error: " + (e instanceof Error ? e.message : "unknown") } });
  }
}
