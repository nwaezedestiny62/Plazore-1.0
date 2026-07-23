import { verifyWebhook } from "@clerk/express/webhooks";
import User from "../models/User.js";
export const clerkWebhook = async (req, res) => {
    try {
        const evt = await verifyWebhook(req);
        if (evt.type === 'user.created' || evt.type === 'user.updated') {
            const user = await User.findOne({ clerkId: evt.data.id });
            // Safely extract the primary email
            const primaryEmail = evt.data.email_addresses?.find((e) => e.id === evt.data.primary_email_address_id);
            const email = primaryEmail ? primaryEmail.email_address : evt.data.email_addresses?.[0]?.email_address || '';
            const userData = {
                clerkId: evt.data.id,
                email: email,
                // Safely format the name
                name: `${evt.data.first_name || ''} ${evt.data.last_name || ''}`.trim() || 'User',
                image: evt.data.image_url,
            };
            if (user) {
                await User.findOneAndUpdate({ clerkId: evt.data.id }, userData);
            }
            else {
                await User.create(userData);
            }
        }
        return res.json({ success: true, message: "Webhook received" });
    }
    catch (err) {
        console.error('Error verifying webhook:', err);
        return res.status(400).send('Error verifying webhook');
    }
};
