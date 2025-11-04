const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authenticateToken');
const { createOrder } = require('../controllers/orderController');

router.post('/', authenticateToken, createOrder);

module.exports = router;
