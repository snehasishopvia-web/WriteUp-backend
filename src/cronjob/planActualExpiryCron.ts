import cron from "node-cron";
import { AccountModel } from "../models/account.model.js";
import { planActualExpiryReminderEmail } from "@/utils/planActualExpiryReminderEmail.js";

export const planActualExpiryCron = () => {
  // Run everyday at 9 AM
  cron.schedule("0 9 * * *", async () => {
    console.log("Checking actual plan expiry...");

    const today = new Date();
    const formatted = today.toISOString().split("T")[0];

    
    const expiringAccounts = await AccountModel.findActualPlanExpiry(formatted as string);

    for (const account of expiringAccounts) {
      await planActualExpiryReminderEmail({
        email: account.owner_email,
        name: account.owner_name,
        trialEndDate: formatted ?? "",
        accountId: account.id,
      });
    }
  });
};
