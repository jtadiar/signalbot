import { NextRequest, NextResponse } from "next/server";
import { validateKey } from "@/lib/license";

export async function POST(req: NextRequest) {
  try {
    const { key } = await req.json();
    const valid = await validateKey(key);
    return NextResponse.json({ valid });
  } catch {
    return NextResponse.json({ valid: false }, { status: 400 });
  }
}
