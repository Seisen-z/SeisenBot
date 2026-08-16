import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const universeId = req.nextUrl.searchParams.get("universeId")?.trim();
  if (!universeId || !/^\d+$/.test(universeId)) {
    return NextResponse.json({ error: "Invalid universeId" }, { status: 400 });
  }

  try {
    const [thumbRes, gameRes] = await Promise.all([
      fetch(
        `https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false`,
        { next: { revalidate: 3600 } }
      ),
      fetch(
        `https://games.roblox.com/v1/games?universeIds=${universeId}`,
        { next: { revalidate: 3600 } }
      ),
    ]);

    const [thumbData, gameData] = await Promise.all([thumbRes.json(), gameRes.json()]);

    const imageUrl = thumbData?.data?.[0]?.imageUrl ?? null;
    const gameName = gameData?.data?.[0]?.name ?? null;

    if (!imageUrl) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ imageUrl, gameName });
  } catch {
    return NextResponse.json({ error: "Roblox API error" }, { status: 502 });
  }
}
