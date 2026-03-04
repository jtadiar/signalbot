import Stripe from 'stripe';
import { createLicenseKey } from './lib/keys.mjs';
import { sendLicenseKeyEmail } from './lib/email.mjs';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.error('Webhook signature verification failed:', e.message);
    return new Response(`Webhook Error: ${e.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details?.email || session.customer_email;
    const paymentId = session.payment_intent;
    const plan = session.metadata?.plan || 'standard';

    if (!email) {
      console.error('No email found in checkout session', session.id);
      return new Response('No email', { status: 400 });
    }

    try {
      const license = await createLicenseKey(email, paymentId, plan);
      await sendLicenseKeyEmail(email, license.key, plan);
      console.log(`License key sent to ${email}: ${license.key}`);
    } catch (e) {
      console.error('Failed to create/send license key:', e.message);
      return new Response('Processing error', { status: 500 });
    }
  }

  return new Response('ok', { status: 200 });
};

export const config = { path: '/api/webhook-stripe' };
