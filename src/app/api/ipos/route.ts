import { NextResponse, type NextRequest } from "next/server";
import { getIposBySlugs, listIpos } from "@/lib/db";
import { listQuerySchema, slugListSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/** Read-only, validated JSON API for the UI (watchlist/reminders) — never exposes provider keys. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  try {
    const slugsRaw = sp.get("slugs");
    if (slugsRaw !== null) {
      const slugs = slugListSchema.safeParse(slugsRaw);
      if (!slugs.success) return NextResponse.json({ error: "Invalid slugs" }, { status: 400 });
      return NextResponse.json({ ipos: await getIposBySlugs(slugs.data) }, { headers: { "Cache-Control": "private, max-age=30" } });
    }
    const q = listQuerySchema.parse(Object.fromEntries(sp));
    return NextResponse.json({ ipos: await listIpos(q) }, { headers: { "Cache-Control": "public, max-age=30" } });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
