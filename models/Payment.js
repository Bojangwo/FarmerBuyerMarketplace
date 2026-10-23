
const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    order: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Order",
  required: true,
},

    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    provider: {
      type: String,
      enum: ["modempay"],
      default: "modempay",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      enum: ["GMD"],
      default: "GMD",
      required: true,
    },

    status: {
  type: String,
  enum: [
    "initializing",
    "pending",
    "successful",
    "failed",
    "cancelled",
    "refunded",
  ],
  default: "initializing",
},

    providerPaymentId: {
      type: String,
      default: null,
    },

    paymentLink: {
      type: String,
      default: null,
    },

    failureReason: {
      type: String,
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Avoid associating the same provider payment
// reference with multiple payment records.
paymentSchema.index(
  { provider: 1, providerPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      providerPaymentId: { $type: "string" },
    },
  }
);

// Only one pending payment attempt per order.
// Failed and cancelled attempts can be retried.
paymentSchema.index(
  { order: 1 },
  {
    name: "unique_active_payment_per_order",
    unique: true,
    partialFilterExpression: {
      status: { $in: ["initializing", "pending"] },
    },
  }
);

module.exports = mongoose.model("Payment", paymentSchema);
