import { NextResponse } from "next/server";

const GITHUB_REPO = "jtadiar/signalbot";
const RELEASE_TAG = "latest";

async function getLatestReleaseAssets(): Promise<
  { name: string; url: string }[]
> {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/releases/${RELEASE_TAG}`,
    { next: { revalidate: 300 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.assets || []).map((a: { name: string; browser_download_url: string }) => ({
    name: a.name,
    url: a.browser_download_url,
  }));
}

function findAsset(assets: { name: string; url: string }[], platform: string) {
  if (platform === "mac") {
    return (
      assets.find((a) => a.name.includes("universal") && a.name.endsWith(".dmg")) ||
      assets.find((a) => a.name.endsWith(".dmg"))
    );
  }
  if (platform === "windows") {
    return (
      assets.find((a) => a.name.endsWith("-setup.exe")) ||
      assets.find((a) => a.name.endsWith(".exe")) ||
      assets.find((a) => a.name.endsWith(".msi"))
    );
  }
  return undefined;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform");

  if (!platform || !["mac", "windows"].includes(platform)) {
    return NextResponse.json(
      { error: "Specify ?platform=mac or ?platform=windows" },
      { status: 400 }
    );
  }

  const assets = await getLatestReleaseAssets();
  const asset = findAsset(assets, platform);

  if (!asset) {
    return NextResponse.json(
      { error: "Installer not available yet. Build may still be in progress." },
      { status: 404 }
    );
  }

  return NextResponse.redirect(asset.url);
}
