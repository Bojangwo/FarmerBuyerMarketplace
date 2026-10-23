
require("dotenv").config();

const mongoose = require("mongoose");
const Payment = require("./models/Payment");
const Order = require("./models/Order");
const { retrievePaymentIntent } = require("./services/paymentService");

const LOCAL_PAYMENT_ID = "6ada517b39d4cdedafdf05b0";
const PROVIDER_PAYMENT_ID = "c7a2cbf8-5373-4067-8692-5fe552f97bf4";

async function reconcile() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const payment = await Payment.findById(LOCAL_PAYMENT_ID);

    if (!payment) {
      throw new Error("Local payment record not found");
    }

    if (payment.status !== "initializing") {
      throw new Error("Payment is no longer initializing");
    }

    if (payment.providerPaymentId || payment.paymentLink) {
      throw new Error("Payment already has gateway details");
    }

    const order = await Order.findById(payment.order);

    if (!order) {
      throw new Error("Associated order not found");
    }

    if (
  !["unpaid", "failed"].includes(order.paymentStatus) ||
  order.status !== "pending"
) {
  throw new Error("Order is not eligible for reconciliation");
}

    if (
      String(order.buyer) !== String(payment.buyer) ||
      order.totalAmount !== payment.amount ||
      order.currency !== payment.currency
    ) {
      throw new Error("Local order and payment do not match");
    }

    const intent = await retrievePaymentIntent(
      PROVIDER_PAYMENT_ID
    );

    const paymentLink = intent?.payment_link || intent?.link;

    if (
      intent?.id !== PROVIDER_PAYMENT_ID ||
      intent?.amount !== payment.amount ||
      intent?.currency !== payment.currency ||
      intent?.test_mode !== true ||
      intent?.status !== "requires_payment_method" ||
      typeof paymentLink !== "string" ||
      !paymentLink.startsWith("https://")
    ) {
      throw new Error("Gateway payment validation failed");
    }

    const successfulPayment = await Payment.exists({
  order: order._id,
  status: "successful",
});

if (successfulPayment) {
  throw new Error("Order already has a successful payment");
}

const otherActivePayment = await Payment.exists({
  order: order._id,
  _id: { $ne: payment._id },
  status: { $in: ["initializing", "pending"] },
});

if (otherActivePayment) {
  throw new Error("Another active payment exists for this order");
}

    // Save the existing gateway details only if the
    // local payment is still in its expected state.
    const updatedPayment = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        status: "initializing",
        providerPaymentId: null,
      },
      {
        $set: {
          providerPaymentId: intent.id,
          paymentLink,
          status: "pending",
        },
      },
      { new: true }
    );

    if (!updatedPayment) {
      throw new Error("Payment changed during reconciliation");
    }

    const orderUpdate = await Order.updateOne(
  {
    _id: order._id,
    paymentStatus: { $in: ["unpaid", "failed"] },
    status: "pending",
  },
  {
    $set: {
      paymentStatus: "pending",
    },
  }
);

    if (orderUpdate.matchedCount !== 1) {
      throw new Error(
        "Payment saved, but order was not updated. Manual review required."
      );
    }

    console.log("Reconciliation completed:", {
      localPaymentId: String(updatedPayment._id),
      providerPaymentId: updatedPayment.providerPaymentId,
      paymentStatus: updatedPayment.status,
      orderPaymentStatus: "pending",
      amount: updatedPayment.amount,
      currency: updatedPayment.currency,
      hasPaymentLink: Boolean(updatedPayment.paymentLink),
    });
  } catch (error) {
    console.error("Reconciliation error:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

reconcile();
