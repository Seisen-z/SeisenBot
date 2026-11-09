import { NextRequest, NextResponse } from "next/server";

// ?universeId=ID            -> the game's square icon (default, used by the embed editor)
// ?universeId=ID&type=cover -> the game's cover photo (wide 16:9 image from the game page)
export async function GET(req: NextRequest) {
  const universeId = req.nextUrl.searchParams.get("universeId")?.trim();
  const type = req.nextUrl.searchParams.get("type") === "cover" ? "cover" : "icon";
  if (!universeId || !/^\d+$/.test(universeId)) {
    return NextResponse.json({ error: "Invalid universeId" }, { status: 400 });
  }

  const imageApi =
    type === "cover"
      ? `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${universeId}&countPerUniverse=1&defaults=true&size=768x432&format=Png&isCircular=false`
      : `https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false`;

  try {
    const [thumbRes, gameRes] = await Promise.all([
      fetch(imageApi, { next: { revalidate: 3600 } }),
      fetch(
        `https://games.roblox.com/v1/games?universeIds=${universeId}`,
        { next: { revalidate: 3600 } }
      ),
    ]);

    const [thumbData, gameData] = await Promise.all([thumbRes.json(), gameRes.json()]);

    const imageUrl =
      type === "cover"
        ? thumbData?.data?.[0]?.thumbnails?.find((entry: { state?: string }) => entry?.state === "Completed")?.imageUrl ?? null
        : thumbData?.data?.[0]?.imageUrl ?? null;
    const gameName = gameData?.data?.[0]?.name ?? null;

    if (!imageUrl) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ imageUrl, gameName });
  } catch {
    return NextResponse.json({ error: "Roblox API error" }, { status: 502 });
  }
}
