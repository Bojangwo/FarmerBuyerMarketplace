const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");

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


const getMyDeliveries = async (req, res) => {
  try {
    const orders = await Order.find({
      deliveryAgent: req.user.id,
    })
      .populate("product", "name description images price unit")
      .populate("buyer", "name phone")
      .populate("farmer", "name phone")
      .sort({ createdAt: -1 })
      .lean();

    const deliveries = orders.map((order) => ({
      _id: order._id,
      orderNumber: order.orderNumber,

      // Product information
      product: order.product,
      quantity: order.quantity,
      unitPrice: order.unitPrice,
      subtotal: order.subtotal,

      // Payment and order information
      deliveryFee: order.deliveryFee,
      totalAmount: order.totalAmount,
      currency: order.currency,
      paymentStatus: order.paymentStatus,
      status: order.status,

      // Delivery information
      deliveryAddress: order.deliveryAddress,
      deliveryStatus: order.deliveryStatus,

      // Buyer and farmer contact information
      buyer: order.buyer,
      farmer: order.farmer,

      // Dates
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }));

    return res.status(200).json({
      count: deliveries.length,
      deliveries,
    });
  } catch (error) {
    console.error("Get my deliveries error:", error);

    return res.status(500).json({
      message: "Server error while fetching assigned deliveries",
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
  const session = await mongoose.startSession();

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

    const allowedTransitions = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["processing", "cancelled"],
      processing: ["ready_for_delivery"],
      ready_for_delivery: ["completed"],
      completed: [],
      cancelled: [],
    };

    let responseStatus = 200;
    let responseBody;

    await session.withTransaction(async () => {
      // Find an order belonging to this farmer.
      const order = await Order.findOne({
        _id: orderId,
        farmer: req.user.id,
      }).session(session);

      if (!order) {
        responseStatus = 404;
        responseBody = {
          message: "Order not found",
        };
        return;
      }

      // Check whether this status change is allowed.
      if (!allowedTransitions[order.status].includes(status)) {
        responseStatus = 400;
        responseBody = {
          message: `Cannot change order status from ${order.status} to ${status}`,
        };
        return;
      }

      // Restore product stock when an order is cancelled.
      if (status === "cancelled") {
        const product = await Product.findById(
          order.product
        ).session(session);

        if (!product) {
          responseStatus = 404;
          responseBody = {
            message: "Product not found. Order was not cancelled.",
          };
          return;
        }

        const stockUpdate = {
          $inc: {
            quantity: order.quantity,
          },
        };

        // Make an out-of-stock product available again.
        // Do not reactivate inactive or sold products.
        if (product.status === "out_of_stock") {
          stockUpdate.$set = {
            status: "available",
          };
        }

        await Product.updateOne(
          { _id: product._id },
          stockUpdate,
          { session }
        );
      }

      // Update the order in the same transaction.
      order.status = status;
      await order.save({ session });

      responseStatus = 200;
      responseBody = {
        message: "Order status updated successfully",
        order,
      };
    });

    return res.status(responseStatus).json(responseBody);
  } catch (error) {
    console.error("Update order status error:", error);

    return res.status(500).json({
      message: "Server error while updating order status",
    });
  } finally {
    await session.endSession();
  }
};



const assignDeliveryAgent = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { deliveryAgentId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        message: "Invalid order ID",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(deliveryAgentId)) {
      return res.status(400).json({
        message: "Invalid delivery agent ID",
      });
    }

    const agent = await User.findOne({
      _id: deliveryAgentId,
      role: "deliveryAgent",
      status: "active",
    }).select("_id name phone role status");

    if (!agent) {
      return res.status(404).json({
        message: "Active delivery agent not found",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    
if (order.status !== "ready_for_delivery") {
  return res.status(400).json({
    message:
      "A delivery agent can only be assigned when the order is ready for delivery",
  });
}


    if (
  !["not_assigned", "assigned", "failed"].includes(
    order.deliveryStatus
  )
) {
  return res.status(400).json({
    message:
      "This delivery cannot be assigned or reassigned in its current status",
  });
}

    order.deliveryAgent = agent._id;
    order.deliveryStatus = "assigned";

    await order.save();

    return res.status(200).json({
      message: "Delivery agent assigned successfully",
      order,
      deliveryAgent: agent,
    });
  } catch (error) {
    console.error("Assign delivery agent error:", error);

    return res.status(500).json({
      message: "Server error while assigning delivery agent",
    });
  }
};

const updateDeliveryStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { deliveryStatus } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        message: "Invalid order ID",
      });
    }

    const allowedStatuses = [
      "picked_up",
      "in_transit",
      "delivered",
      "failed",
    ];

    if (!allowedStatuses.includes(deliveryStatus)) {
      return res.status(400).json({
        message: "Invalid delivery status",
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      deliveryAgent: req.user.id,
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found or not assigned to you",
      });
    }

    // The farmer must prepare the order before pickup.
    if (
      deliveryStatus === "picked_up" &&
      order.status !== "ready_for_delivery"
    ) {
      return res.status(400).json({
        message:
          "The order must be ready for delivery before it can be picked up",
      });
    }

    // Prevent delivery of cancelled or completed orders.
    if (["cancelled", "completed"].includes(order.status)) {
      return res.status(400).json({
        message: "Cannot update delivery status for this order",
      });
    }

    const allowedTransitions = {
  not_assigned: [],
  assigned: ["picked_up", "failed"],
  picked_up: ["in_transit", "failed"],
  in_transit: ["delivered", "failed"],
  delivered: [],
  failed: [],
};

    if (
      !allowedTransitions[order.deliveryStatus] ||
      !allowedTransitions[order.deliveryStatus].includes(deliveryStatus)
    ) {
      return res.status(400).json({
        message: `Cannot change delivery status from ${order.deliveryStatus} to ${deliveryStatus}`,
      });
    }

    order.deliveryStatus = deliveryStatus;

    // Keep the main order status in sync after successful delivery.
    if (deliveryStatus === "delivered") {
      order.status = "completed";
    }

    await order.save();

    return res.status(200).json({
      message: "Delivery status updated successfully",
      order,
    });
  } catch (error) {
    console.error("Update delivery status error:", error);

    return res.status(500).json({
      message: "Server error while updating delivery status",
    });
  }
};




module.exports = {
  getMyOrders,
  getMyDeliveries,
  getOrderById,
  updateOrderStatus,
  assignDeliveryAgent,
  updateDeliveryStatus,
};