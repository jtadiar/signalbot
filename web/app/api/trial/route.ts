import { NextResponse } from "next/server";
import { createLicense } from "@/lib/license";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required." }, { status: 400 });
    }

    const trialSessionId = `trial_${Date.now()}_${email}`;
    const key = createLicense(email.trim().toLowerCase(), trialSessionId);

    return NextResponse.json({ key });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
