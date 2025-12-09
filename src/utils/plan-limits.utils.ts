import { pool } from "../config/postgres.db.js";
import { createError } from "../middleware/error.middleware.js";

/**
 * Interface for plan limit check result
 */
export interface PlanLimitCheck {
  allowed: boolean;
  currentCount: number;
  maxAllowed: number;
  remaining: number;
  message?: string;
}

/**
 * Get current count of teachers in a school
 */
export async function getCurrentTeacherCount(schoolId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) as count 
     FROM users 
     WHERE school_id = $1 
       AND user_type = 'teacher' 
       AND is_active = true 
       AND deleted_at IS NULL`,
    [schoolId]
  );
  return parseInt(result.rows[0]?.count || "0", 10);
}

/**
 * Get current count of students in a school
 */
export async function getCurrentStudentCount(schoolId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) as count 
     FROM users 
     WHERE school_id = $1 
       AND user_type = 'student' 
       AND is_active = true 
       AND deleted_at IS NULL`,
    [schoolId]
  );
  return parseInt(result.rows[0]?.count || "0", 10);
}

/**
 * Get plan limits for an admin user by their user ID
 */
export async function getPlanLimitsByUserId(userId: string): Promise<{
  total_students: number;
  total_teachers: number;
  total_classes: number;
  total_schools: number;
}> {
  const result = await pool.query(
    `SELECT total_students, total_teachers, total_classes, total_schools 
     FROM users 
     WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw createError("User not found", 404);
  }

  return {
    total_students: result.rows[0]?.total_students || 0,
    total_teachers: result.rows[0]?.total_teachers || 0,
    total_classes: result.rows[0]?.total_classes || 0,
    total_schools: result.rows[0]?.total_schools || 0,
  };
}

/**
 * Get plan limits for a school (through the admin user)
 */
export async function getPlanLimitsBySchoolId(schoolId: string): Promise<{
  total_students: number;
  total_teachers: number;
  total_classes: number;
  total_schools: number;
}> {
  // Find admin user for this school
  const result = await pool.query(
    `SELECT u.total_students, u.total_teachers, u.total_classes, u.total_schools 
     FROM users u
     WHERE u.school_id = $1 
       AND u.user_type = 'admin' 
       AND u.is_active = true
       AND u.deleted_at IS NULL
     LIMIT 1`,
    [schoolId]
  );

  if (result.rows.length === 0) {
    // If no admin found, try to find any user through the school's admin_id
    const accountResult = await pool.query(
      `SELECT u.total_students, u.total_teachers, u.total_classes, u.total_schools 
       FROM users u
       INNER JOIN schools s ON s.admin_id = u.id
       WHERE s.id = $1
         AND u.is_active = true
         AND u.deleted_at IS NULL
       LIMIT 1`,
      [schoolId]
    );

    if (accountResult.rows.length === 0) {
      throw createError("No plan limits found for this school", 404);
    }

    return {
      total_students: accountResult.rows[0]?.total_students || 0,
      total_teachers: accountResult.rows[0]?.total_teachers || 0,
      total_classes: accountResult.rows[0]?.total_classes || 0,
      total_schools: accountResult.rows[0]?.total_schools || 0,
    };
  }

  return {
    total_students: result.rows[0]?.total_students || 0,
    total_teachers: result.rows[0]?.total_teachers || 0,
    total_classes: result.rows[0]?.total_classes || 0,
    total_schools: result.rows[0]?.total_schools || 0,
  };
}

/**
 * Check if adding new teachers would exceed plan limits
 */
export async function checkTeacherLimit(
  schoolId: string,
  additionalTeachers: number = 1
): Promise<PlanLimitCheck> {
  const currentCount = await getCurrentTeacherCount(schoolId);
  const limits = await getPlanLimitsBySchoolId(schoolId);
  const maxAllowed = limits.total_teachers;
  const newTotal = currentCount + additionalTeachers;
  const remaining = maxAllowed - currentCount;

  const allowed = newTotal <= maxAllowed;

  return {
    allowed,
    currentCount,
    maxAllowed,
    remaining,
    message: allowed
      ? `You can add ${additionalTeachers} teacher(s). ${remaining} slot(s) remaining.`
      : `Cannot add ${additionalTeachers} teacher(s). You have ${currentCount}/${maxAllowed} teachers. Only ${remaining} slot(s) remaining.`,
  };
}

/**
 * Check if adding new students would exceed plan limits
 */
export async function checkStudentLimit(
  schoolId: string,
  additionalStudents: number = 1
): Promise<PlanLimitCheck> {
  const currentCount = await getCurrentStudentCount(schoolId);
  const limits = await getPlanLimitsBySchoolId(schoolId);
  const maxAllowed = limits.total_students;
  const newTotal = currentCount + additionalStudents;
  const remaining = maxAllowed - currentCount;

  const allowed = newTotal <= maxAllowed;

  return {
    allowed,
    currentCount,
    maxAllowed,
    remaining,
    message: allowed
      ? `You can add ${additionalStudents} student(s). ${remaining} slot(s) remaining.`
      : `Cannot add ${additionalStudents} student(s). You have ${currentCount}/${maxAllowed} students. Only ${remaining} slot(s) remaining.`,
  };
}

/**
 * Validate teacher limit before creation - throws error if limit exceeded
 */
export async function validateTeacherLimit(
  schoolId: string,
  additionalTeachers: number = 1
): Promise<void> {
  const check = await checkTeacherLimit(schoolId, additionalTeachers);
  
  if (!check.allowed) {
    throw createError(
      `Teacher limit exceeded. ${check.message} Please upgrade your plan to add more teachers.`,
      403
    );
  }
}

/**
 * Validate student limit before creation - throws error if limit exceeded
 */
export async function validateStudentLimit(
  schoolId: string,
  additionalStudents: number = 1
): Promise<void> {
  const check = await checkStudentLimit(schoolId, additionalStudents);
  
  if (!check.allowed) {
    throw createError(
      `Student limit exceeded. ${check.message} Please upgrade your plan to add more students.`,
      403
    );
  }
}

/**
 * Get current count of classes in a school
 */
export async function getCurrentClassCount(schoolId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) as count 
     FROM classes 
     WHERE school_id = $1 
       AND is_active = true`,
    [schoolId]
  );
  return parseInt(result.rows[0]?.count || "0", 10);
}

/**
 * Check if adding new classes would exceed plan limits
 */
export async function checkClassLimit(
  schoolId: string,
  additionalClasses: number = 1
): Promise<PlanLimitCheck> {
  const currentCount = await getCurrentClassCount(schoolId);
  const limits = await getPlanLimitsBySchoolId(schoolId);
  const maxAllowed = limits.total_classes;
  const newTotal = currentCount + additionalClasses;
  const remaining = maxAllowed - currentCount;

  const allowed = newTotal <= maxAllowed;

  return {
    allowed,
    currentCount,
    maxAllowed,
    remaining,
    message: allowed
      ? `You can add ${additionalClasses} class(es). ${remaining} slot(s) remaining.`
      : `Cannot add ${additionalClasses} class(es). You have ${currentCount}/${maxAllowed} classes. Only ${remaining} slot(s) remaining.`,
  };
}

/**
 * Validate class limit before creation - throws error if limit exceeded
 */
export async function validateClassLimit(
  schoolId: string,
  additionalClasses: number = 1
): Promise<void> {
  const check = await checkClassLimit(schoolId, additionalClasses);
  
  if (!check.allowed) {
    throw createError(
      `Class limit exceeded. ${check.message} Please upgrade your plan to add more classes.`,
      403
    );
  }
}

/**
 * Get plan usage summary for display to users (especially teachers)
 * This provides all the information needed to show available slots
 */
export async function getPlanUsageSummary(schoolId: string): Promise<{
  students: {
    current: number;
    limit: number;
    remaining: number;
    percentUsed: number;
  };
  teachers: {
    current: number;
    limit: number;
    remaining: number;
    percentUsed: number;
  };
  classes: {
    current: number;
    limit: number;
    remaining: number;
    percentUsed: number;
  };
  subscription: {
    isActive: boolean;
    endDate: Date | null;
    daysRemaining: number | null;
  };
}> {
  // Get current counts
  const currentStudents = await getCurrentStudentCount(schoolId);
  const currentTeachers = await getCurrentTeacherCount(schoolId);
  
  // Get limits
  const limits = await getPlanLimitsBySchoolId(schoolId);
  
  // Get class count
  const classResult = await pool.query(
    `SELECT COUNT(*) as count 
     FROM classes 
     WHERE school_id = $1 
       AND is_active = true`,
    [schoolId]
  );
  const currentClasses = parseInt(classResult.rows[0]?.count || "0", 10);

  // Get subscription info
  const subscriptionResult = await pool.query(
    `SELECT a.subscription_status, a.subscription_end_date 
     FROM accounts a
     JOIN users u ON u.account_id = a.id
     JOIN schools s ON s.admin_id = u.id
     WHERE s.id = $1
     LIMIT 1`,
    [schoolId]
  );

  let subscriptionInfo = {
    isActive: false,
    endDate: null as Date | null,
    daysRemaining: null as number | null,
  };

  if (subscriptionResult.rows.length > 0) {
    const account = subscriptionResult.rows[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    subscriptionInfo.isActive = ['active', 'trialing', 'paid'].includes(account.subscription_status);
    
    if (account.subscription_end_date) {
      const endDate = new Date(account.subscription_end_date);
      endDate.setHours(0, 0, 0, 0);
      subscriptionInfo.endDate = endDate;

      const diffTime = endDate.getTime() - today.getTime();
      subscriptionInfo.daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (endDate < today) {
        subscriptionInfo.isActive = false;
      }
    }
  }

  return {
    students: {
      current: currentStudents,
      limit: limits.total_students,
      remaining: limits.total_students - currentStudents,
      percentUsed: limits.total_students > 0 
        ? Math.round((currentStudents / limits.total_students) * 100) 
        : 0,
    },
    teachers: {
      current: currentTeachers,
      limit: limits.total_teachers,
      remaining: limits.total_teachers - currentTeachers,
      percentUsed: limits.total_teachers > 0 
        ? Math.round((currentTeachers / limits.total_teachers) * 100) 
        : 0,
    },
    classes: {
      current: currentClasses,
      limit: limits.total_classes,
      remaining: limits.total_classes - currentClasses,
      percentUsed: limits.total_classes > 0 
        ? Math.round((currentClasses / limits.total_classes) * 100) 
        : 0,
    },
    subscription: subscriptionInfo,
  };
}
