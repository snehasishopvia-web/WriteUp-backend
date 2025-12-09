import cron from "node-cron";
import { AccountModel } from "../models/account.model.js";
import { SchoolModel } from "../models/school.model.js";
import { UserModel } from "../models/user.model.js";
import { sendStudentPlanExpiredEmail } from "@/utils/studentSubscriptionExpiryEmail.js";

export const studentExpiryCron = () => {
  cron.schedule("0 9 * * *", async () => {
    console.log("Checking expired accounts to notify students...");

    const [today] = new Date().toISOString().split("T");

    const expiredAccounts = await AccountModel.findExpiredFinalPlans(today ?? "");

    if (!expiredAccounts.length) {
      console.log("No expired accounts today.");
      return;
    }

    for (const account of expiredAccounts) {
      const school = await SchoolModel.findByAccountId(account.id);
      if (!school) continue;

      const students = await UserModel.findStudentsBySchoolId(school.id);

      for (const student of students) {
        await sendStudentPlanExpiredEmail({
          email: student.email ?? "",
          name: `${student.first_name} ${student.last_name}`.trim(),
          schoolName: school.name,
        });
      }
    }
  });
};
