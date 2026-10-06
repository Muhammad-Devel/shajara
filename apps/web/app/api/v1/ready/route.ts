export const dynamic = "force-dynamic";

/** Readiness: dependencies configured. Real DB ping is added with the database phase. */
export function GET() {
  const database = process.env.DATABASE_URL ? "configured" : "not_configured";
  return Response.json({
    success: true,
    data: { status: "ready", checks: { database } },
    error: null,
  });
}
