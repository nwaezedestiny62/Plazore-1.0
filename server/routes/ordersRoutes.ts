import express from 'express'
import { createOrder, getAllOrders, getOrder, getOrders, updateOrderStatus } from '../controllers/ordersController.js'
import { authorize, protect } from '../middleware/auth.js'

const OrderRouter = express.Router()

// Get user orders
OrderRouter.get('/', protect, getOrders)

// Get single order
OrderRouter.get('/:id', protect, getOrder)

// Create order from cart
OrderRouter.post('/', protect, createOrder)

// Update order status (Admin)
OrderRouter.put('/:id/status', protect, authorize("admin"), updateOrderStatus)

// Get all orders
OrderRouter.get('/:id/all', protect, authorize("admin"), getAllOrders)

export default OrderRouter;