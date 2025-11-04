const Order = require('../models/order');

// 🧾 Place a new order
exports.createOrder = async (req, res) => {
  try {
    const { medicineId, quantity, paymentMethod } = req.body;

    const newOrder = new Order({
      userId: req.user.userId,
      medicineId,
      quantity,
      paymentMethod,
      status: paymentMethod === 'COD' ? 'COD' : 'Pending',
    });

    await newOrder.save();
    res.status(201).json({
      message: 'Order placed successfully ✅',
      order: newOrder,
    });
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ message: 'Error placing order', error: error.message });
  }
};
