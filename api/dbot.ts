export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawBody = await req.text();
  const interaction = JSON.parse(rawBody);

  if (interaction.type === 1) {
    return Response.json({ type: 1 });
  }

  return Response.json({ type: 4, data: { content: "ok" } });
}
