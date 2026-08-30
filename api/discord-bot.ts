export const runtime = "nodejs";

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const rawBody = await req.text();
    const interaction = JSON.parse(rawBody);

    // PING (type 1) — respond with PONG
    if (interaction.type === 1) {
      return Response.json({ type: 1 });
    }

    return Response.json({ type: 4, data: { content: "ok" } });
  } catch {
    return Response.json({ type: 4, data: { content: "error" } });
  }
}
