require("dotenv").config();

const ModemPay = require("modem-pay").default;

let modempayClient = null;

function getModemPayClient() {
  const secretKey = process.env.MODEM_PAY_SECRET_KEY;

  if (!secretKey) {
    throw new Error(
      "MODEM_PAY_SECRET_KEY is missing from backend/.env"
    );
  }

  if (!modempayClient) {
    modempayClient = new ModemPay(secretKey);
  }

  return modempayClient;
}

function normalizePaymentIntent(response) {
  const intent =
    response?.data &&
    !Array.isArray(response.data)
      ? response.data
      : response;

  if (
    response?.status === false ||
    !intent ||
    typeof intent !== "object"
  ) {
    throw new Error("Modem Pay returned an invalid response");
  }

  return intent;
}

async function createPaymentIntent({ amount }) {
  if (
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isSafeInteger(Math.round(amount * 100))
  ) {
    throw new Error("Invalid payment amount");
  }

  const client = getModemPayClient();

  const response = await client.paymentIntents.create({
    amount,
    currency: "GMD",
  });

  const intent = normalizePaymentIntent(response);

  const providerPaymentId =
  intent.payment_intent_id || intent.id;

  const paymentLink =
    intent.payment_link ||
    intent.paymentLink ||
    intent.link ||
    intent.checkout_url ||
    intent.checkoutUrl;

  const providerAmount = Number(intent.amount);

  const validAmount =
    Number.isFinite(providerAmount) &&
    Math.round(providerAmount * 100) ===
      Math.round(amount * 100);

  const validLink =
    typeof paymentLink === "string" &&
    /^https:\/\//i.test(paymentLink);

  if (
    typeof providerPaymentId !== "string" ||
!providerPaymentId.trim() ||
    !validLink ||
    intent.currency !== "GMD" ||
    !validAmount
  ) {
    console.error("Modem Pay validation failed:", {
      hasId: Boolean(intent.id),
      hasPaymentLink: validLink,
      currencyMatches: intent.currency === "GMD",
      amountMatches: validAmount,
      responseKeys: Object.keys(intent),
    });

    throw new Error(
      "Modem Pay returned an invalid payment intent"
    );
  }

  return {
  providerPaymentId,
  paymentLink,
  providerStatus: intent.status || null,
  providerAmount,
  providerCurrency: intent.currency,
  expiresAt:
    intent.expires_at ||
    intent.expiresAt ||
    null,
};
}

async function retrievePaymentIntent(paymentId) {
  const client = getModemPayClient();

  return client.paymentIntents.retrieve(paymentId);
}

module.exports = {
  createPaymentIntent,
  retrievePaymentIntent,
};