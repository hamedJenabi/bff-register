import Stripe from "stripe";
import { getUserByEmailAndName } from "../../db/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const price = req.body.price;
  let grossPrice;

  const percentFee = 0.014; // 1.4% fee
  const fixedFee = 25; // €0.25 in cents
  if (price === 0) {
    grossPrice = 0;
  } else {
    grossPrice = Math.round((price + fixedFee) / (1 - percentFee));
  }

  const userswithSameEmail = await getUserByEmailAndName(req.body.user.email);
  let isAlreadyRegistered = false;
  if (userswithSameEmail) {
    isAlreadyRegistered =
      userswithSameEmail.email + userswithSameEmail.firstname ===
      req.body.user.email + req.body.user.firstname;
  }
  let isSoldOut = false;
  //******** Check Capacity ********/
  if (isAlreadyRegistered) {
    // redirect to alreadyRegistered page
    return res.status(302).json();
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "ideal", "sepa_debit", "sofort", "klarna"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "Your BFF'25 Ticket",
            },
            unit_amount: grossPrice,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.origin}/accept?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/cancel`,
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
