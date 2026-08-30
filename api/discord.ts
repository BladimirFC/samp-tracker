export const runtime = "nodejs";

async function handlePost(req: Request): Promise<Response> {
  try {
    const rawBody = await req.text();
    const interaction = JSON.parse(rawBody);
    if (interaction.type === 1) {
      return Response.json({ type: 1 });
    }
    return Response.json({ type: 4, data: { content: "ok" } });
  } catch {
    return Response.json({ type: 4, data: { content: "error" } });
  }
}

export { handlePost as POST };
