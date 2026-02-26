import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2026-02-25.clover",
});

const BASE_URL = process.env.NEXT_PUBLIC_URL || "https://hlsignalbot.netlify.app";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required." }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email.trim().toLowerCase(),
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Signalbot License" },
            unit_amount: 2900,
          },
          quantity: 1,
        },
      ],
      success_url: `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/#pricing`,
      metadata: { email: email.trim().toLowerCase() },
    });

    return NextResponse.json({ url: session.url });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
