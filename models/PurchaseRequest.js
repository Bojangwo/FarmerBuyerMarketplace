const mongoose = require("mongoose");

const purchaseRequestSchema = new mongoose.Schema(
  {
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    quantityRequested: {
      type: Number,
      required: true,
      min: 0.01,
    },

    message: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "rejected",
        "cancelled",
        "expired",
      ],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

purchaseRequestSchema.index({ buyer: 1 });
purchaseRequestSchema.index({ farmer: 1 });
purchaseRequestSchema.index({ product: 1 });
purchaseRequestSchema.index({ status: 1 });

const PurchaseRequest = mongoose.model(
  "PurchaseRequest",
  purchaseRequestSchema
);

module.exports = PurchaseRequest;