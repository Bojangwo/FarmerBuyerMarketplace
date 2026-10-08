const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    images: [
      {
        type: String,
      },
    ],

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    unit: {
      type: String,
      required: true,
      trim: true,
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },

      coordinates: {
        type: [Number],
        required: true,
      },

      address: {
        type: String,
        trim: true,
        default: "",
      },

      city: {
        type: String,
        trim: true,
        default: "",
      },

      region: {
        type: String,
        trim: true,
        default: "",
      },
    },

    status: {
      type: String,
      enum: [
        "available",
        "out_of_stock",
        "sold",
        "inactive",
      ],
      default: "available",
    },
  },
  {
    timestamps: true,
  }
);

// Geospatial index
productSchema.index({ location: "2dsphere" });

// Useful for browsing products by category
productSchema.index({ category: 1 });

// Useful for finding a farmer's products
productSchema.index({ farmer: 1 });

// Useful for filtering available products
productSchema.index({ status: 1 });

const Product = mongoose.model("Product", productSchema);

module.exports = Product;