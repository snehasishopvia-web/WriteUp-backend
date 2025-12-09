
import { paidPlanExpiryFollowUpCron } from "./paidPlanExpiryFollowUpCron";
import { planActualExpiryCron } from "./planActualExpiryCron";
import { studentExpiryCron } from "./studentExpiryCron";


export const startCronJobs = () => {
  console.log("Starting all cron jobs...");
  planActualExpiryCron();
 paidPlanExpiryFollowUpCron();
  studentExpiryCron();
};
