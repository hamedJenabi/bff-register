import React, { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import Card from "../Card/Card";
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = loadStripe(publishableKey);
import axios from "axios";

const Payment = ({ form, totalPrice = 115 }) => {
  const [item, setItem] = useState({
    name: "Partypass",
    description:
      "After Payment, you will receive a confirmation email with all the information you need.",
    image: "https://www.bluesfever.eu/wp-content/uploads/2023/01/bff23.png",
    quantity: 1,
    price: totalPrice,
  });
  const createCheckOutSession = async () => {
    const stripe = await stripePromise;
    const checkoutSession = await axios.post("/api/create-stripe-session", {
      item: item,
    });
    const result = await stripe.redirectToCheckout({
      sessionId: checkoutSession.data.id,
    });
    if (result.error) {
      alert(result.error.message);
    }
  };
  return <button onClick={createCheckOutSession}>Buy</button>;
};
export default Payment;
