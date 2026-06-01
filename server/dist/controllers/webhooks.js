import { verifyWebhook } from "@clerk/express/webhooks";
import User from "../models/User.js";

export const clerkWebhook = async (req, res) => {
    try {
        const evt = await verifyWebhook(req);
       
        console.log(`✅ Webhook Received - Type: ${evt.type}`);

        if (evt.type === 'user.created' || evt.type === 'user.updated') {
            const { id, email_addresses, first_name, last_name, image_url } = evt.data;

            const userData = {
                clerkId: id,
                email: email_addresses?.[0]?.email_address,
                name: [first_name, last_name].filter(Boolean).join(" ").trim() || "New User",
                image: image_url,
            };

            const user = await User.findOneAndUpdate(
                { clerkId: id },
                userData,
                { upsert: true, new: true }
            );

            console.log("✅ User Saved in MongoDB:", user);
        }

        return res.status(200).json({ success: true });

    } catch (err) {
        console.error("❌ Webhook Failed:", err.message);
        return res.status(400).json({ success: false, error: err.message });
    }
};