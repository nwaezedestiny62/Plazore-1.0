import Cart from "../models/Cart.js";
import Product from '../models/Products.js';
// Get user cart
// GET /api/cart
export const getCart = async (req, res) => {
    try {
        let cart = await Cart.findOne({ user: req.user._id }).populate("items.product", "name images price stock");
        if (!cart) {
            cart = await Cart.create({ user: req.user._id, items: [] });
        }
        res.json({ success: true, data: cart });
    }
    catch (error) {
        res.json(500).json({ success: false, message: error.message });
    }
};
// Add Item to cart
// POST /api/cart/add
export const addtoCart = async (req, res) => {
    try {
        const { productId, quantity = 1 } = req.body;
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }
        if (product.stock < quantity) {
            return res.status(404).json({ success: false, message: "Insufficient stock" });
        }
        let cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            cart = new Cart({ user: req.user._id, item: [] });
        }
        // Find item with same product and size 
        const exisitingItem = cart.items.find((item) => {
            return item.product.toString() === productId;
        });
        if (exisitingItem) {
            exisitingItem.quantity += quantity;
            exisitingItem.price = product.price;
        }
        else {
            cart.items.push({
                product: productId,
                quantity,
                price: product.price,
            });
        }
        cart.calculateTotal();
        await cart.save();
        await cart.populate("items.product", "name images price stock");
        res.json({ success: true, data: cart });
    }
    catch (error) {
        res.json(500).json({ success: false, message: error.message });
    }
};
// Update cart item quantity
// PUT /api/cart/item/:productId
export const updateCartItem = async (req, res) => {
    try {
        const { quantity } = req.body;
        const { productId } = req.params;
        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            return res.status(404).json({ success: false, message: "Cart not found" });
        }
        const item = cart.items.find((item) => item.product.toString() === productId);
        if (!item) {
            return res.status(404).json({ success: false, message: "Item not in cart" });
        }
        if (quantity <= 0) {
            cart.items = cart.items.filter((item) => item.product.toString() !== productId);
        }
        else {
            const product = await Product.findById(productId);
            if (product.stock < quantity) {
                return res.status(400).json({ success: false, message: "Insufficient stock" });
            }
            item.quantity = quantity;
        }
        cart.calculateTotal();
        await cart.save();
        await cart.populate("items.product", "name images price stock");
        res.json({ success: true, data: cart });
    }
    catch (error) {
        res.json(500).json({ success: false, message: error.message });
    }
};
// Remove item from cart
// DELETE /api/cart/item/:productId
export const removeCartItem = async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            return res.status(404).json({ success: false, message: "Cart not found" });
        }
        cart.items = cart.items.filter((item) => item.product.toString() !== req.params.productId);
        cart.calculateTotal();
        await cart.save();
        await cart.populate("items.product", "name images price stock");
    }
    catch (error) {
        res.json(500).json({ success: false, message: error.message });
    }
};
// Clear cart
// DELETE /api/cart/item/:productId
export const clearCart = async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id });
        if (cart) {
            cart.items = [];
            cart.totalAmount = 0;
            await cart.save();
        }
    }
    catch (error) {
        res.json(500).json({ success: false, message: error.message });
    }
};
