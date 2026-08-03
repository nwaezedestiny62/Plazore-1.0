import "dotenv/config";
import express, { Request, Response } from 'express';
import cors from "cors";
import connectDB from "./config/db.js";
import { clerkMiddleware } from '@clerk/express'
import { clerkWebhook } from "./controllers/webhooks.js";
import makeAdmin from "./scripts/makeAdmin.js";
import ProductRouter from "./routes/productsRoutes.js";
import CartRouter from "./routes/cartRoutes.js";
import OrderRouter from "./routes/ordersRoutes.js";
import AddressRouter from "./routes/addressRoutes.js";
import AdminRouter from "./routes/adminRoutes.js";
import SellerRouter from "./routes/sellerRoutes.js";
import NotificationRouter from "./routes/notificationRoutes.js";
import UserRouter from "./routes/userRoutes.js";
import WishlistRouter from "./routes/wishlistRoutes.js";
import AnalyticsRouter from "./routes/analyticsRoutes.js";
import AIRouter from "./routes/aiRoutes.js";

const app = express();

// Connect to MongoDB
await connectDB();

app.post('/api/clerk', express.raw({type: "application/json"}), clerkWebhook)

// Middleware
app.use(cors({
  origin: true,           // Allow all for now (good for development)
  credentials: true
}));
app.use(express.json());
app.use(clerkMiddleware());

const port = process.env.PORT || 3000;

// ====================== PUBLIC TEST ROUTES ======================
app.get('/api/test', (req: Request, res: Response) => {
    console.log("✅ PUBLIC /api/test route hit!");
    res.json({ success: true, message: "Backend is reachable!" });
});

app.get('/api', (req: Request, res: Response) => {
    res.json({ success: true, message: "Root API endpoint working" });
});

// ====================== MAIN ROUTES ======================
app.get('/', (req: Request, res: Response) => {
    res.send('Server is Live!');
});

app.use("/api/products", ProductRouter)
app.use("/api/cart", CartRouter)
app.use("/api/orders", OrderRouter)
app.use("/api/addresses", AddressRouter)
app.use("/api/admin", AdminRouter)
app.use("/api/seller", SellerRouter);
app.use("/api/notifications", NotificationRouter);
app.use("/api/users", UserRouter);
app.use("/api/wishlist", WishlistRouter);
app.use("/api/analytics", AnalyticsRouter);
app.use("/api/ai", AIRouter);

await makeAdmin();

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}` );
    console.log(`Test it at: http://localhost:${port}/api/test`);
});