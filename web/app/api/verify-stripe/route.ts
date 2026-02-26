import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createLicense } from "@/lib/license";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
  return new Stripe(key, { apiVersion: "2026-02-25.clover" });
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "Session ID required." }, { status: 400 });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment not completed." }, { status: 400 });
    }

    const email =
      session.metadata?.email ||
      session.customer_email ||
      session.customer_details?.email;

    if (!email) {
      return NextResponse.json({ error: "No email found in session." }, { status: 400 });
    }

    const key = await createLicense(email.trim().toLowerCase());
    return NextResponse.json({ key });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
