require("dotenv").config();

const ModemPay = require("modem-pay").default;

async function checkPayments() {
  try {
    const client = new ModemPay(process.env.MODEM_PAY_SECRET_KEY);

    const response = await client.paymentIntents.list({ limit: 20 });

    const intents = Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response)
        ? response
        : [];

    const matches = intents
      .filter((intent) =>
        Number(intent.amount) === 300 &&
        intent.currency === "GMD"
      )
      .map((intent) => ({
        id: intent.id,
        amount: intent.amount,
        currency: intent.currency,
        status: intent.status,
        createdAt: intent.createdAt || intent.created_at
      }));

    console.log("D300 payment intents:", matches);
  } catch (error) {
    console.error("Lookup failed:", error.message);
  }
}

checkPayments();