export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    if (body.type === 1) {
      return Response.json({ type: 1 });
    }
    return Response.json({ type: 4, data: { content: "ok" } });
  } catch {
    return Response.json({ type: 4, data: { content: "error" } });
  }
}
