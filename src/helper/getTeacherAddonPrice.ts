import { Plan } from "@/models/plan.model.js";

/**
 * Get addon prices from plan object
 * Returns { studentPrice, teacherPrice } based on purchase type
 */
export const getAddonPrices = (
  plan: Plan,
  purchaseType: "subscription" | "one_time"
): { studentPrice: number; teacherPrice: number } => {
  const isMonthly = purchaseType === "subscription";
  
  return {
    studentPrice: isMonthly 
      ? (plan.extra_student_price_monthly ?? 3)
      : (plan.extra_student_price_yearly ?? 36),
    teacherPrice: isMonthly
      ? (plan.extra_teacher_price_monthly ?? 5)
      : (plan.extra_teacher_price_yearly ?? 60)
  };
};
