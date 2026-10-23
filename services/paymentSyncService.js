
const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const Order = require("../models/Order");
const { retrievePaymentIntent } = require("./paymentService");

async function syncPayment(paymentId) {
  if (!mongoose.Types.ObjectId.isValid(paymentId)) {
    throw new Error("Invalid payment ID");
  }

  const payment = await Payment.findById(paymentId);

  if (!payment || !payment.providerPaymentId) {
    throw new Error("Payment not found or not initialized");
  }

  const intent = await retrievePaymentIntent(payment.providerPaymentId);

  // Never trust an unverified payment result.
  if (
    intent?.id !== payment.providerPaymentId ||
    intent?.amount !== payment.amount ||
    intent?.currency !== payment.currency
  ) {
    throw new Error("Provider payment details do not match");
  }

  const statusMap = {
  initialized: "pending",
  requires_payment_method: "pending",
  processing: "pending",
  successful: "successful",
  failed: "failed",
  cancelled: "cancelled",
  expired: "failed"
};

  console.log("Modem Pay payment status:", {
  paymentId: payment.providerPaymentId,
  status: intent.status,
  statusType: typeof intent.status
});

  const newStatus = statusMap[intent.status];

  if (!newStatus) {
    throw new Error("Unknown provider payment status");
  }

  const order = await Order.findById(payment.order);

  if (
    !order ||
    String(order.buyer) !== String(payment.buyer) ||
    order.totalAmount !== payment.amount ||
    order.currency !== payment.currency
  ) {
    throw new Error("Payment and order details do not match");
  }

  // Never downgrade a successful payment.
  if (payment.status === "successful" || order.paymentStatus === "paid") {
  if (
    payment.status !== "successful" ||
    order.paymentStatus !== "paid" ||
    newStatus !== "successful"
  ) {
    throw new Error(
      "Payment and order require manual reconciliation"
    );
  }

  return {
    paymentStatus: "successful",
    orderPaymentStatus: "paid"
  };
}

  // Already processed attempts must not change the order again.
if (payment.status !== "pending") {
  if (
    ["failed", "cancelled", "refunded"].includes(payment.status)
  ) {
    if (newStatus === "successful") {
      throw new Error(
        "Provider reports success for a closed payment. Manual reconciliation required."
      );
    }

    return {
      paymentStatus: payment.status,
      orderPaymentStatus: order.paymentStatus
    };
  }

  throw new Error("Payment is not eligible for synchronization");
}

  // Avoid silently changing completed or cancelled orders.
  if (order.status !== "pending" || order.paymentStatus !== "pending") {
    throw new Error("Order is not eligible for payment synchronization");
  }

  // A pending provider result requires no database changes.
  if (newStatus === "pending") {
    return {
      paymentStatus: payment.status,
      orderPaymentStatus: order.paymentStatus
    };
  }

  const orderPaymentStatus =
    newStatus === "successful" ? "paid" : "failed";

  // Use a transaction so payment and order change together.
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const paymentUpdate = await Payment.updateOne(
        { _id: payment._id, status: "pending" },
        {
          $set: {
            status: newStatus,
            ...(newStatus === "successful" ? { paidAt: new Date() } : {})
          }
        },
        { session }
      );

      if (paymentUpdate.matchedCount !== 1) {
        throw new Error("Payment changed during synchronization");
      }

      const orderUpdate = await Order.updateOne(
        {
          _id: order._id,
          status: "pending",
          paymentStatus: "pending"
        },
        { $set: { paymentStatus: orderPaymentStatus } },
        { session }
      );

      if (orderUpdate.matchedCount !== 1) {
        throw new Error("Order changed during synchronization");
      }
    });
    } catch (error) {
    // Another webhook may have completed the payment update first.
    // Re-read the database rather than assuming synchronization failed.
    const latestPayment = await Payment.findById(payment._id);
    const latestOrder = await Order.findById(payment.order);

    if (
      latestPayment &&
      latestOrder &&
      latestPayment.status === newStatus &&
      latestOrder.paymentStatus === orderPaymentStatus &&
      latestPayment.status !== "pending"
    ) {
      return {
        paymentStatus: latestPayment.status,
        orderPaymentStatus: latestOrder.paymentStatus
      };
    }

    // Any other error still requires investigation or retry.
    throw error;
  } finally {
    await session.endSession();
  }

  return {
    paymentStatus: newStatus,
    orderPaymentStatus
  };
}

module.exports = { syncPayment };
