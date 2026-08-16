import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const universeId = req.nextUrl.searchParams.get("universeId")?.trim();
  if (!universeId || !/^\d+$/.test(universeId)) {
    return NextResponse.json({ error: "Invalid universeId" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false`,
      { next: { revalidate: 3600 } }
    );
    const data = await res.json();
    const imageUrl = data?.data?.[0]?.imageUrl ?? null;
    if (!imageUrl) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ imageUrl });
  } catch {
    return NextResponse.json({ error: "Roblox API error" }, { status: 502 });
  }
}
