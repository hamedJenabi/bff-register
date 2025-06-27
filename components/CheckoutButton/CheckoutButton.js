import { useState } from "react";

export default function CheckoutButton() {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    const res = await fetch("/api/checkout", {
      method: "POST",
      // add price
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price: 200,
      }),
    });

    const data = await res.json();
    if (data.url) {
      window.location.href = data.url; // Redirect to Stripe
    }
    setLoading(false);
  };

  return (
    <button
      onClick={handleCheckout}
      disabled={loading}
      style={{
        padding: "10px 20px",
        background: "blue",
        color: "white",
        border: "none",
        cursor: "pointer",
      }}
    >
      {loading ? "Redirecting..." : "Pay Now"}
    </button>
  );
}
