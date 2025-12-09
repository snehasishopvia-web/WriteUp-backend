import cron from "node-cron";
import { AccountModel } from "../models/account.model.js";
import { paidPlanExpiryFollowUpReminderEmail } from "@/utils/paidPlanExpiryFollowUpReminderEmail.js";

export const paidPlanExpiryFollowUpCron = () => {
  // Runs every day at 9 AM
  cron.schedule("0 9 * * *", async () => {
    console.log("Checking paid plan expiry follow-up (2 days after expiry)...");

    const today = new Date();
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(today.getDate() - 2);

    const formatted = twoDaysAgo.toISOString().split("T")[0];

    // 2 days ago
    const accountsExpiredTwoDaysAgo =
      await AccountModel.findPaidPlansExpiredOn(formatted as string);

    for (const account of accountsExpiredTwoDaysAgo) {
      await paidPlanExpiryFollowUpReminderEmail({
        email: account.owner_email,
        name: account.owner_name,
        schoolName: account.school_name ?? "",
        endDate: formatted ?? "",
        accountId: account.id,
      });
    }
  });
};
