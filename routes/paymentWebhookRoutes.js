
const express = require("express");
const router = express.Router();
const { webhook } = require("../controllers/paymentWebhookController");

router.post("/", express.raw({ type: "application/json" }), webhook);

module.exports = router;
