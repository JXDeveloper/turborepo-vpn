import stripe from "stripe";

export const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!);
