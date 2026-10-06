export const dynamic = "force-dynamic";

/** Liveness: the process is up. */
export function GET() {
  return Response.json({
    success: true,
    data: { status: "ok", time: new Date().toISOString() },
    error: null,
  });
}
