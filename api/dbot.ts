export const runtime = "nodejs";

async function handlePost(req: Request): Promise<Response> {
  const rawBody = await req.text();
  const interaction = JSON.parse(rawBody);

  if (interaction.type === 1) {
    return Response.json({ type: 1 });
  }

  return Response.json({ type: 4, data: { content: "ok" } });
}

async function handleGet(): Promise<Response> {
  return new Response("Discord Bot Endpoint", { status: 200 });
}

export { handleGet as GET, handlePost as POST };
