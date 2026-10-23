
const ModemPay = require("modem-pay").default;
const Payment = require("../models/Payment");
const { syncPayment } = require("../services/paymentSyncService.js");

const webhook = async (req, res) => {
  const secret = process.env.MODEM_PAY_WEBHOOK_SECRET;
  const headerName = process.env.MODEM_PAY_WEBHOOK_SIGNATURE_HEADER;

  if (!secret || !headerName) {
    return res.status(503).json({ message: "Webhook not configured" });
  }

  const signature = req.get(headerName);

  if (!signature || !Buffer.isBuffer(req.body)) {
    return res.status(400).json({ message: "Invalid webhook request" });
  }

  let event;

  try {
    const client = new ModemPay(process.env.MODEM_PAY_SECRET_KEY);

    event = client.webhooks.composeEventDetails(
      req.body.toString("utf8"),
      signature,
      secret
    );
  } catch (error) {
    return res.status(400).json({ message: "Invalid webhook signature" });
  }

  const eventType = event?.event;
  const paymentIntentId = event?.payload?.payment_intent_id;

  // Ignore events unrelated to payment status.
  const relevantEvents = [
    "charge.succeeded",
    "charge.failed",
    "charge.cancelled",
    "payment_intent.cancelled"
  ];

  if (!relevantEvents.includes(eventType)) {
    return res.status(200).json({
      message: "Event acknowledged"
    });
  }

  // Some simulated events may not contain a usable payment ID.
  if (
    typeof paymentIntentId !== "string" ||
    !paymentIntentId.trim()
  ) {
    return res.status(200).json({
      message: "No payment intent reference; event ignored"
    });
  }

  try {
    const payment = await Payment.findOne({
      provider: "modempay",
      providerPaymentId: paymentIntentId
    });

    if (!payment) {
  console.log(
    "Webhook acknowledged: no matching local payment"
  );

  return res.status(200).json({
    message: "No matching local payment; event acknowledged"
  });
}

    // Verify the actual payment status directly with Modem Pay.
    // Never mark an order paid from the webhook event alone.
    const result = await syncPayment(payment._id);

    console.log("Webhook payment synchronized:", {
      paymentId: String(payment._id),
      status: result.paymentStatus
    });

    return res.status(200).json({
      message: "Payment synchronized"
    });
  } catch (error) {
    console.error("Webhook synchronization failed:", error.message);

    // A temporary failure should allow Modem Pay to retry.
    return res.status(500).json({
      message: "Payment synchronization failed"
    });
  }
};

module.exports = { webhook };
