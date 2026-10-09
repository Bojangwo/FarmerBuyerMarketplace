const mongoose = require("mongoose");
const Order = require("../models/Order");

// Get orders belonging to the logged-in buyer or farmer
const getMyOrders = async (req, res) => {
  try {
    let filter;

    if (req.user.role === "buyer") {
      filter = { buyer: req.user.id };
    } else if (req.user.role === "farmer") {
      filter = { farmer: req.user.id };
    } else {
      return res.status(403).json({
        message: "You are not allowed to view these orders",
      });
    }

    const orders = await Order.find(filter)
      .populate("product", "name images price unit")
      .populate("buyer", "name phone")
      .populate("farmer", "name phone")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error("Get my orders error:", error);

    return res.status(500).json({
      message: "Server error while fetching orders",
    });
  }
};

// Get details of one order belonging to the logged-in buyer or farmer
const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!require("mongoose").Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        message: "Invalid order ID",
      });
    }

    let filter = { _id: orderId };

    if (req.user.role === "buyer") {
      filter.buyer = req.user.id;
    } else if (req.user.role === "farmer") {
      filter.farmer = req.user.id;
    } else {
      return res.status(403).json({
        message: "You are not allowed to view this order",
      });
    }

    const order = await Order.findOne(filter)
      .populate("product", "name description images price unit")
      .populate("buyer", "name phone")
      .populate("farmer", "name phone");

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    return res.status(200).json({ order });
  } catch (error) {
    console.error("Get order details error:", error);

    return res.status(500).json({
      message: "Server error while fetching order details",
    });
  }
};



const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        message: "Invalid order ID",
      });
    }

    const allowedStatuses = [
      "confirmed",
      "processing",
      "ready_for_delivery",
      "completed",
      "cancelled",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid order status",
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      farmer: req.user.id,
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    const allowedTransitions = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["processing", "cancelled"],
      processing: ["ready_for_delivery"],
      ready_for_delivery: ["completed"],
      completed: [],
      cancelled: [],
    };

    if (!allowedTransitions[order.status].includes(status)) {
      return res.status(400).json({
        message: `Cannot change order status from ${order.status} to ${status}`,
      });
    }

    order.status = status;
    await order.save();

    return res.status(200).json({
      message: "Order status updated successfully",
      order,
    });
  } catch (error) {
    console.error("Update order status error:", error);

    return res.status(500).json({
      message: "Server error while updating order status",
    });
  }
};


module.exports = {
  getMyOrders,
  getOrderById,
  updateOrderStatus,
};