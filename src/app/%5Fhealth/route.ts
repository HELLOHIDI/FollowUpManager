export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = () =>
  Response.json(
    {
      status: "ok",
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  );
