import { verifyWebhook } from "@clerk/express/webhooks";
import User from "../models/User.js";

export const clerkWebhook = async (req, res) => {
    try {
        const evt = await verifyWebhook(req);

        console.log(`Clerk Webhook Event: ${evt.type}`);

        if (evt.type === 'user.created' || evt.type === 'user.updated') {
            const { id, email_addresses, first_name, last_name, image_url } = evt.data;

            const email = email_addresses?.[0]?.email_address;
            const name = [first_name, last_name]
                .filter(Boolean)
                .join(" ")
                .trim() || "New User";

            const userData = {
                clerkId: id,
                email: email,
                name: name,
                image: image_url,
            };

            // Better: Use upsert (update if exists, create if not)
            const user = await User.findOneAndUpdate(
                { clerkId: id },
                userData,
                { upsert: true, new: true }
            );

            console.log("✅ User synced:", user);
        }

        return res.status(200).json({ success: true, message: "Webhook received" });

    } catch (err) {
        console.error('❌ Webhook Error:', err);
        return res.status(400).json({ 
            success: false, 
            message: "Error verifying webhook",
            error: err.message 
        });
    }
};