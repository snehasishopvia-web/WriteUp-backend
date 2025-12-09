import { PlanModel } from "@/models/plan.model";
import { UserModel } from "@/models/user.model";


//  Apply plan limits to a user including extras like extra teachers or students.
 
export async function applyPlanLimits(
  accountId: string,
  planSlug: string,
  extras: { teachers?: number; students?: number } = {}
) {
  const plan = await PlanModel.findBySlug(planSlug);
  if (!plan) return;

  const user = await UserModel.findPrimaryByAccountId(accountId);
  if (!user) return;

  const totalTeachers = (plan.max_teachers_per_school || 0) + (extras.teachers || 0);
  const totalStudents = (plan.max_students_per_school || 0) + (extras.students || 0);

  await UserModel.update(user.id, {
    total_teachers: totalTeachers,
    total_students: totalStudents,
    total_classes: plan.max_classes_per_school || 0,
    total_schools: plan.max_schools || 0,
  });

  console.log(
    `Plan limits applied for user ${user.id}: teachers=${totalTeachers}, students=${totalStudents}`
  );
}
