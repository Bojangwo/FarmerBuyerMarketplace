
const mongoose = require("mongoose");

const Order = require("../models/Order");
const Payment = require("../models/Payment");
const { createPaymentIntent } = require("../services/paymentService");
const { syncPayment } = require("../services/paymentSyncService.js");

const initiatePayment = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        message: "Invalid order ID",
      });
    }

    // Only retrieve an order belonging to the logged-in buyer.
    const order = await Order.findOne({
      _id: orderId,
      buyer: req.user.id,
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    if (order.status !== "pending") {
      return res.status(400).json({
        message: "This order is not eligible for payment",
      });
    }

    if (order.paymentStatus === "paid") {
      return res.status(400).json({
        message: "This order has already been paid",
      });
    }

    if (!["unpaid", "failed"].includes(order.paymentStatus)) {
      return res.status(409).json({
        message: "This order has an existing payment process",
      });
    }

    const successfulPayment = await Payment.exists({
  order: order._id,
  status: "successful",
});

if (successfulPayment) {
  return res.status(409).json({
    message: "This order already has a successful payment",
  });
}

    if (
      !Number.isFinite(order.totalAmount) ||
      order.totalAmount <= 0 ||
      order.currency !== "GMD"
    ) {
      return res.status(400).json({
        message: "Invalid order payment amount or currency",
      });
    }

    // Reserve one active payment attempt before contacting the gateway.
    let payment;

    try {
      payment = await Payment.create({
        order: order._id,
        buyer: req.user.id,
        provider: "modempay",
        amount: order.totalAmount,
        currency: order.currency,
        status: "initializing",
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          message: "A payment attempt already exists for this order",
        });
      }

      throw error;
    }

    try {
      const intent = await createPaymentIntent({
        amount: order.totalAmount,
      });

      payment.providerPaymentId = intent.providerPaymentId;
      payment.paymentLink = intent.paymentLink;
      payment.status = "pending";

      await payment.save();

      const orderUpdate = await Order.updateOne(
  {
    _id: order._id,
    status: "pending",
    paymentStatus: { $in: ["unpaid", "failed"] },
  },
  {
    $set: { paymentStatus: "pending" },
  }
);

if (orderUpdate.matchedCount !== 1) {
  console.error(
    "Payment intent created, but order status could not be updated:",
    payment._id.toString()
  );

  return res.status(409).json({
    message:
      "Payment was created, but the order needs reconciliation. Do not initiate another payment.",
    paymentId: payment._id,
  });
}

      return res.status(201).json({
        message: "Payment initiated successfully",
        paymentId: payment._id,
        orderId: order._id,
        amount: payment.amount,
        currency: payment.currency,
        paymentStatus: "pending",
        paymentLink: payment.paymentLink,
      });
    } catch (error) {
      // A gateway timeout may mean an intent was created remotely.
      // Keep the local attempt reserved until its outcome is reconciled.
      console.error("Payment initiation error:", error.message);

      return res.status(502).json({
        message:
          "Payment initiation could not be confirmed. Please do not retry immediately.",
        paymentId: payment._id,
      });
    }
  } catch (error) {
    console.error("Initiate payment error:", error);

    return res.status(500).json({
      message: "Server error while initiating payment",
    });
  }
};



const { retrievePaymentIntent } = require("../services/paymentService");


const verifyPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
      return res.status(400).json({ message: "Invalid payment ID" });
    }

    const payment = await Payment.findOne({
      _id: paymentId,
      buyer: req.user.id
    });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    const result = await syncPayment(payment._id);

    return res.status(200).json({
      message: "Payment synchronized with Modem Pay",
      paymentId: payment._id,
      ...result
    });
  } catch (error) {
    console.error("Payment synchronization error:", error.message);

    return res.status(502).json({
      message: "Payment could not be synchronized. Please try again later."
    });
  }
};



module.exports = {
  initiatePayment,
  verifyPayment
};
