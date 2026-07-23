import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import { getDashboardStats } from "../controllers/adminController.js";
import { getAuth } from "@clerk/express";   // ← Add this import

const AdminRouter = express.Router();

// ==================== DEBUG ROUTE (Temporary) ====================
AdminRouter.get('/debug', protect, (req, res) => {
    const auth = getAuth(req);
    console.log("Full Auth Object from Clerk:", auth);
    
    res.json({
        success: true,
        clerkAuth: auth,
        userFromDB: req.user
    });
});

// ==================== MAIN ROUTES ====================

// Get admin dashboard statistics
// GET /api/admin/stats
AdminRouter.get(
    "/stats",
    protect,
    authorize("admin"),
    getDashboardStats
);

// You can add more admin routes here later
// Example:
// AdminRouter.get("/users", protect, authorize("admin"), getAllUsers);
// AdminRouter.post("/products", protect, authorize("admin"), createProduct);

export default AdminRouter;