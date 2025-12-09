import { Request, Response, NextFunction } from "express";
import { asyncHandler, createError } from "../middleware/error.middleware.js";
import { SchoolModel } from "../models/school.model.js";
import { UserModel } from "../models/user.model.js";
import {
  SaveOnboardingDataDTO,
  SchoolType,
  ClassStructureType,
  SchoolTypeLabels,
  ClassStructureTypeLabels,
} from "../types/school.types.js";
import { pool } from "../config/postgres.db.js";
import multer from "multer";
import { parseCSV, validateCSVHeaders } from "../utils/csv.utils.js";
import { getTimezoneFromRequest } from "../utils/timezone.utils.js";
import { sendStudentOnboardEmail } from "../utils/sendStudentOnboardEmail.utils.js";
import { sendTeacherOnboardEmail } from "@/utils/sendTeacherOnboardEmail.js";
import { 
  checkTeacherLimit,
  checkStudentLimit
} from "../utils/plan-limits.utils.js";
import { validateSubscriptionBySchoolId } from "../utils/subscription.utils.js";

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith(".csv")) {
      return cb(new Error("Only CSV files are allowed"));
    }
    cb(null, true);
  },
});

export const uploadTeacherMiddleware = upload.single("csv_file");
export const uploadStudentMiddleware = upload.single("csv_file");

/**
 * @route   DELETE /api/v1/auth/onboarding/delete-teacher-upload
 * @desc    Delete teacher upload information
 * @access  Private (Admin only)
 */
export const deleteTeacherUpload = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) throw createError("User not authenticated", 401);

    const school = await SchoolModel.deleteTeacherUpload(req.user.id);

    if (!school) throw createError("No school found for this admin", 404);

    res.status(200).json({
      success: true,
      message: "Teacher upload information deleted successfully",
      data: SchoolModel.sanitizeSchool(school),
    });
  }
);

/**
 * @route   DELETE /api/v1/auth/onboarding/delete-student-upload
 * @desc    Delete student upload information
 * @access  Private (Admin only)
 */
export const deleteStudentUpload = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) throw createError("User not authenticated", 401);

    const school = await SchoolModel.deleteStudentUpload(req.user.id);

    if (!school) throw createError("No school found for this admin", 404);

    res.status(200).json({
      success: true,
      message: "Student upload information deleted successfully",
      data: SchoolModel.sanitizeSchool(school),
    });
  }
);

/**
 * @route   POST /api/v1/auth/onboarding/save-data
 * @desc    Save school onboarding data (Step 3)
 * @access  Private (Admin only)
 */
export const saveOnboardingData = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) throw createError("User not authenticated", 401);

    const {
      name,
      school_type,
      class_structure_type,
      timezone: providedTimezone,
      additional_programs,
    } = req.body;

    // Auto-detect timezone if not provided
    const timezone = providedTimezone || getTimezoneFromRequest(req);

    const data: SaveOnboardingDataDTO = {
      name,
      school_type,
      class_structure_type,
      timezone,
      additional_programs: additional_programs || [],
    };

    // Create or update school
    const { school, created } = await SchoolModel.createOrUpdate(
      req.user.id,
      data
    );

    const updateUser = await UserModel.updateSchoolId(req.user.id, school.id);
    console.log("updated user - ", updateUser);

    const sanitized = SchoolModel.sanitizeSchool(school);

    res.status(created ? 201 : 200).json({
      success: true,
      message: created
        ? "School information created successfully"
        : "School information updated successfully",
      data: {
        ...sanitized,
        created,
      },
    });
  }
);

/**
 * @route   GET /api/v1/auth/onboarding/admin-school
 * @desc    Get admin's school information
 * @access  Private (Admin only)
 */
export const getAdminSchool = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) throw createError("User not authenticated", 401);

    const school = await SchoolModel.findByAdmin(req.user.id);
    console.log("^^^^^^^^^^^^^^^%%", school);

    if (!school) {
      res.status(200).json({
        success: true,
        has_school: false,
        message: "Admin has not registered any school yet",
      });
      return;
    }

    res.status(200).json({
      success: true,
      has_school: true,
      data: SchoolModel.sanitizeSchool(school),
    });
  }
);

/**
 * @route   GET /api/v1/auth/onboarding/school-options
 * @desc    Get available school type and class structure options
 * @access  Private (Admin only)
 */
export const getSchoolOptions = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const schoolTypes = Object.values(SchoolType).map((value) => ({
      value,
      label: SchoolTypeLabels[value],
    }));

    const classStructureTypes = Object.values(ClassStructureType).map(
      (value) => ({
        value,
        label: ClassStructureTypeLabels[value],
      })
    );

    res.status(200).json({
      success: true,
      data: {
        school_types: schoolTypes,
        class_structure_types: classStructureTypes,
      },
    });
  }
);

/**
 * @route   POST /api/v1/auth/onboarding/save-programs
 * @desc    Save additional programs (Step 4)
 * @access  Private (Admin only)
 */
export const saveAdditionalPrograms = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) throw createError("User not authenticated", 401);

    const { additional_programs } = req.body;

    if (!Array.isArray(additional_programs))
      throw createError("Additional programs must be an array", 400);

    const school = await SchoolModel.updatePrograms(
      req.user.id,
      additional_programs
    );

    if (!school)
      throw createError(
        "No school found for this admin. Please complete basic onboarding first.",
        404
      );

    res.status(200).json({
      success: true,
      message: "Additional programs saved successfully",
      data: SchoolModel.sanitizeSchool(school),
    });
  }
);

/**
 * @route   POST /api/v1/auth/onboarding/complete-step
 * @desc    Mark an onboarding step as complete
 * @access  Private (Admin only)
 */
export const completeOnboardingStep = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) throw createError("User not authenticated", 401);

    const { step, completed } = req.body;

    const school = await SchoolModel.updateStepCompletion(
      req.user.id,
      step,
      completed
    );

    if (!school) throw createError("No school found for this admin", 404);

    res.status(200).json({
      success: true,
      message: `Step ${step} marked as ${
        completed ? "completed" : "incomplete"
      }`,
      data: {
        school_id: school.id,
        teachers_uploaded: school.teachers_uploaded,
        students_uploaded: school.students_uploaded,
        onboarding_completed: school.onboarding_completed,
        onboarding_progress:
          SchoolModel.sanitizeSchool(school).onboarding_progress,
      },
    });
  }
);

/**
 * @route   GET /api/v1/auth/onboarding/check-status
 * @desc    Check if admin needs onboarding
 * @access  Private
 */
export const checkOnboardingStatus = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) throw createError("User not authenticated", 401);

    if (
      req.user.user_type !== "admin" &&
      req.user.user_type !== "sy_admin" &&
      req.user.user_type !== "teacher"
    )
      return res.status(200).json({
        success: true,
        needs_onboarding: false,
        redirect_to: "/",
        message: "Non-admin users do not need school onboarding",
      });

    let school =
      req.user.user_type === "admin" || req.user.user_type === "sy_admin"
        ? await SchoolModel.findById(req.user.id)
        : req.user.user_type === "teacher"
        ? await SchoolModel.findById(req.schoolId || "")
        : null;

    if (!school)
      return res.status(200).json({
        success: true,
        needs_onboarding: true,
        redirect_to: "/onboarding",
        message: "Admin needs to complete school registration",
      });

    if (!school.onboarding_completed) {
      const sanitized = SchoolModel.sanitizeSchool(school);
      return res.status(200).json({
        success: true,
        needs_onboarding: true,
        redirect_to: "/onboarding",
        current_progress: sanitized.onboarding_progress,
        message: "Admin needs to complete school onboarding",
      });
    }

    return res.status(200).json({
      success: true,
      needs_onboarding: false,
      redirect_to: "/",
      name: school.name,
      message: "Admin onboarding completed",
    });
  }
);

/**
 * @route   POST /api/v1/auth/onboarding/upload-teachers
 * @desc    Upload teachers via CSV (Step 5)
 * @access  Private (Admin only)
 */
export const uploadTeachers = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) throw createError("User not authenticated", 401);

    if (!req.file) throw createError("CSV file is required", 400);

    // Use school from middleware
    if (!req.schoolId || !req.school) {
      throw createError(
        "No school found. Please complete basic onboarding first.",
        404
      );
    }

    const school = req.school;

    // Check if subscription is active
    await validateSubscriptionBySchoolId(req.schoolId);

    // Parse CSV
    const rows = await parseCSV(req.file.buffer);
    if (rows.length === 0) throw createError("CSV file is empty", 400);

    // Check plan limits before processing
    const limitCheck = await checkTeacherLimit(req.schoolId, rows.length);
    if (!limitCheck.allowed) {
      throw createError(
        `Cannot upload ${rows.length} teacher(s). ${limitCheck.message} Please upgrade your plan or reduce the number of teachers in your CSV file.`,
        403
      );
    }
    // if (rows.length > 500) throw createError("Maximum 500 rows allowed", 400);
    // const firstRow = rows.at(0);
    // if (!firstRow) throw createError("CSV file is empty", 400);

    // // Validate headers
    // const headers = Object.keys(firstRow);
    // const requiredHeaders = ["name", "email"];
    // const headerCheck = validateCSVHeaders(headers, requiredHeaders);

    // if (!headerCheck.valid)
    //   throw createError(
    //     `Missing required columns: ${headerCheck.missing.join(", ")}`,
    //     400
    //   );

    // Process teachers
    // const client = await pool.connect();
    // let createdCount = 0;
    // let updatedCount = 0;
    // let failedCount = 0;
    // const failedRows: any[] = [];
    const createdCount = rows.length;
    let failedCount = 0;
    const failedRows: any[] = [];

    // try {
    // await client.query("BEGIN");

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 1;

      try {
        // Validate row
        const name = row!.name?.trim();
        const email = row!.email?.trim().toLowerCase();
        // const subject = row!.subject?.trim();

        if (!name || name.length < 2)
          throw new Error("Name must be at least 2 characters");

        if (!email || !email.match(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/))
          throw new Error("Invalid email format");
        await sendTeacherOnboardEmail(
          email,
          name,
          school.name,
          school.unique_key
        );

        // Split name
        // const nameParts = name.split(" ");
        // const firstName = nameParts[0];
        // const lastName = nameParts.slice(1).join(" ") || "";

        // // Check if user exists
        // const existingUser = await UserModel.findByEmail(email);

        // if (existingUser) {
        //   // Update role and school_id if different
        //   if (
        //     existingUser.user_type !== "teacher" ||
        //     existingUser.school_id !== school.id
        //   ) {
        //     await client.query(
        //       "UPDATE users SET user_type = $1, school_id = $2, updated_at = NOW() WHERE id = $3",
        //       ["teacher", req.schoolId, existingUser.id]
        //     );
        //   }

        //   updatedCount++;
        // } else {
        //   // Create new teacher with school_id
        //   const hashedPassword = await bcrypt.hash("TempTeacher123!", 12);

        //   await client.query(
        //     `INSERT INTO users (
        //       username, email, password, first_name, last_name,
        //       user_type, school_id, subject, is_active
        //     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        //     [
        //       email,
        //       email,
        //       hashedPassword,
        //       firstName,
        //       lastName,
        //       "teacher",
        //       req.schoolId,
        //       subject || "",
        //       true,
        //     ]
        //   );

        //   createdCount++;
        // }
      } catch (error: any) {
        failedCount++;
        failedRows.push({
          row_number: rowNumber,
          name: row!.name || "Unknown",
          errors: [error.message],
        });
      }
    }

    // Save file upload info to database
    // if (createdCount > 0 || updatedCount > 0) {
    //   const uploadSummary = {
    //     created_count: createdCount,
    //     updated_count: updatedCount,
    //     failed_count: failedCount,
    //     total_rows_processed: rows.length,
    //   };

    //   await SchoolModel.saveTeacherUpload(
    //     school.id,
    //     req.file.originalname,
    //     uploadSummary,
    //     client
    //   );
    // }

    // await client.query("COMMIT");

    // const updatedSchool = await SchoolModel.findById(school.id);
    // const message = `Teachers upload complete. Created: ${createdCount}, Updated: ${updatedCount}, Failed: ${failedCount}`;

    // if (failedCount > 0) {
    //   res.status(207).json({
    //     success: false,
    //     message,
    //     summary: {
    //       created_count: createdCount,
    //       updated_count: updatedCount,
    //       failed_count: failedCount,
    //       total_rows_processed: rows.length,
    //     },
    //     failed_rows: failedRows,
    //     partial_success: true,
    //     school: SchoolModel.sanitizeSchool(updatedSchool!),
    //   });
    //   return;
    // }

    // res.status(200).json({
    //   success: true,
    //   message,
    //   summary: {
    //     created_count: createdCount,
    //     updated_count: updatedCount,
    //     failed_count: failedCount,
    //     total_rows_processed: rows.length,
    //   },
    //   school: SchoolModel.sanitizeSchool(updatedSchool!),
    //   warnings: [],
    // });
    res.status(200).json({
      success: true,
      message: `Emails sent. Success: ${
        createdCount - failedCount
      }, Failed: ${failedCount}`,
      summary: {
        total_rows_processed: rows.length,
        created_count: createdCount,
        success_count: createdCount - failedCount,
        failed_count: failedCount,
      },
      failed_rows: failedRows,
    });
  }
  //   catch (error) {
  //     await client.query("ROLLBACK");
  //     next(error);
  //   } finally {
  //     client.release();
  //   }
  // }
);

export const inviteTeachersManually = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) throw createError("User not authenticated", 401);
    if (!req.schoolId || !req.school) throw createError("No school found", 404);

    const { emails } = req.body;
    console.log("*****************888",emails)
    const school = req.school;

    if (!Array.isArray(emails) || emails.length === 0)
      throw createError("No email(s) provided", 400);

    // Check if subscription is active
    await validateSubscriptionBySchoolId(req.schoolId);

    // Check plan limits before processing
    const limitCheck = await checkTeacherLimit(req.schoolId, emails.length);
    if (!limitCheck.allowed) {
      throw createError(
        `Cannot invite ${emails.length} teacher(s). ${limitCheck.message} Please upgrade your plan or reduce the number of invitations.`,
        403
      );
    }

    const failed = [];
    let sent = 0;

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i].trim().toLowerCase();

      // validate email
      if (!email.match(/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/)) {
        failed.push({ email, error: "Invalid email" });
        continue;
      }

      try {
        await sendTeacherOnboardEmail(
          email,
          email.split("@")[0],
          school.name,
          school.unique_key
        );
        sent++;
      } catch (err: any) {
        failed.push({ email, error: err.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Emails sent: ${sent}, Failed: ${failed.length}`,
      sent,
      failed,
    });
  }
);



/**
 * @route   POST /api/v1/auth/onboarding/upload-students
 * @desc    Upload students via CSV (Step 6)
 * @access  Private (Admin only)
 */
export const uploadStudents = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) throw createError("User not authenticated", 401);

    if (!req.file) throw createError("CSV file is required", 400);

    const { hasEmails } = req.body;
    const requireEmail = hasEmails === "Yes";

    // Use school from middleware
    if (!req.schoolId || !req.school) {
      throw createError(
        "No school found. Please complete basic onboarding first.",
        404
      );
    }

    const school = req.school;

    // Check if subscription is active
    await validateSubscriptionBySchoolId(req.schoolId);

    const rows = await parseCSV(req.file.buffer);

    if (rows.length > 1000) throw createError("Maximum 1000 rows allowed", 400);

    // Check plan limits before processing
    const limitCheck = await checkStudentLimit(req.schoolId, rows.length);
    if (!limitCheck.allowed) {
      throw createError(
        `Cannot upload ${rows.length} student(s). ${limitCheck.message} Please upgrade your plan or reduce the number of students in your CSV file.`,
        403
      );
    }

    const firstRow = rows.at(0);
    if (!firstRow) throw createError("CSV file is empty", 400);

    const headers = Object.keys(firstRow);
    const requiredHeaders = ["name"];
    const optionalHeaders = ["email", "department", "graduation_year"];
    const headerCheck = validateCSVHeaders(headers, requiredHeaders);

    if (!headerCheck.valid)
      throw createError(
        `Missing required columns: ${headerCheck.missing.join(", ")}`,
        400
      );

    // const client = await pool.connect();
    let createdCount = 0;
    // let updatedCount = 0;
    let failedCount = 0;
    const failedRows: any[] = [];

    // try {
    // await client.query("BEGIN");

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 1;

      try {
        const name = row!.name?.trim();
        const email = row!.email?.trim().toLowerCase();
        const department = row!.department?.trim();

        if (!name) {
          failedCount++;
          failedRows.push({
            row_number: rowNumber,
            name: "Empty row",
            errors: ["Row is empty - skipped"],
          });
          continue;
        }

        if (!name || name.length < 2)
          throw new Error("Name must be at least 2 characters");

        if (requireEmail && !email)
          throw new Error("Email is required for all students");

        // let validEmail: string | null = null;
        if (email) {
          if (email && !email.match(/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/)) {
            throw new Error("Invalid email format");
          }

          const firstName = name.split(" ")[0] ?? "";
          await sendStudentOnboardEmail(
            email,
            firstName,
            school.name,
            school.unique_key
          );
          createdCount++;
        } else {
          failedCount++;
          failedRows.push({
            row_number: rowNumber,
            name,
            error: ["No Email Provided Skipped"],
          });
        }
        // else {
        //   // If email is provided but invalid, always throw error
        //   throw new Error("Invalid email format");
        // }

        // const nameParts = name.split(" ");
        // const firstName = nameParts[0] ?? "";
        // const lastName = nameParts.slice(1).join(" ") || "";

        // Generate unique admission number and username
        // const admissionNumber = `STU${Date.now()}${Math.floor(
        //   Math.random() * 1000
        // )}`;
        // const uniqueUsername = `student_${admissionNumber}`;

        // let userId: string;

        // if (validEmail) {
        //   const existingUser = await UserModel.findByEmail(validEmail);

        //   if (existingUser) {
        //     // Update role and school_id if different
        //     console.log(
        //       "__________________________________________",
        //       existingUser
        //     );
        //     if (
        //       existingUser.user_type !== "student" ||
        //       existingUser.school_id !== school.id
        //     ) {
        //       await client.query(
        //         "UPDATE users SET user_type = $1, school_id = $2, updated_at = NOW() WHERE id = $3",
        //         ["student", school.id, existingUser.id]
        //       );
        //     }
        //     userId = existingUser.id;
        //     updatedCount++;
        //     if (validEmail) {
        //       sendStudentOnboardEmail(validEmail, firstName, school.name);
        //     }
        //   } else {
        //     console.log(
        //       "++++++++++++++++++++++++++++++++++++++++++++++++++++++++"
        //     );
        //     const hashedPassword = await bcrypt.hash("TempStudent123!", 12);

        //     const userResult = await client.query(
        //       `INSERT INTO users (
        //         username, email, temp_email, password, first_name, last_name,
        //         user_type, school_id, is_active
        //       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        //       RETURNING id`,
        //       [
        //         uniqueUsername,
        //         validEmail,
        //         false, // temp_email = false for real emails
        //         hashedPassword,
        //         firstName,
        //         lastName,
        //         "student",
        //         school.id,
        //         true,
        //       ]
        //     );

        //     userId = userResult.rows[0].id;
        //     createdCount++;
        //     console.log("<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<", validEmail);
        //     if (validEmail) {
        //       sendStudentOnboardEmail(validEmail, firstName, school.name);
        //     }
        //   }
        // } else {
        //   // No email provided - generate a temp email
        //   const hashedPassword = await bcrypt.hash("TempStudent123!", 12);
        //   const tempEmail = `${uniqueUsername}@temp.${school.id}.noemail.local`;

        //   const userResult = await client.query(
        //     `INSERT INTO users (
        //       username, email, temp_email, password, first_name, last_name,
        //       user_type, school_id, is_active
        //     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        //     RETURNING id`,
        //     [
        //       uniqueUsername,
        //       tempEmail,
        //       true, // temp_email flag
        //       hashedPassword,
        //       firstName,
        //       lastName,
        //       "student",
        //       school.id,
        //       true,
        //     ]
        //   );

        //   userId = userResult.rows[0].id;
        //   createdCount++;
        // }

        // const existingProfile = await client.query(
        //   "SELECT id FROM student_profiles WHERE user_id = $1",
        //   [userId]
        // );

        // if (existingProfile.rows.length === 0) {
        //   await client.query(
        //     `INSERT INTO student_profiles (
        //       school_id, user_id, admission_number, admission_date
        //     ) VALUES ($1, $2, $3, NOW())`,
        //     [school.id, userId, admissionNumber]
        //   );
        // }
      } catch (error: any) {
        failedCount++;
        failedRows.push({
          row_number: rowNumber,
          name: row!.name || "Unknown",
          errors: [error.message],
        });
      }
    }
    const message = `Students upload complete. Created: ${createdCount}, Failed: ${failedCount}`;

    // Save file upload info to database
    // if (createdCount > 0 || updatedCount > 0) {
    //   const uploadSummary = {
    //     created_count: createdCount,
    //     updated_count: updatedCount,
    //     failed_count: failedCount,
    //     total_rows_processed: rows.length,
    //   };

    //   await SchoolModel.saveStudentUpload(
    //     school.id,
    //     req.file.originalname,
    //     uploadSummary,
    //     client
    //   );
    // }

    // await client.query("COMMIT");

    // const updatedSchool = await SchoolModel.findById(school.id);
    // const message = `Students upload complete. Created: ${createCount}, Updated: ${updatedCount}, Failed: ${failedCount}`;

    // if (failedCount > 0) {
    //   res.status(207).json({
    //     success: false,
    //     message,
    //     summary: {
    //       created_count: createdCount,
    //       updated_count: updatedCount,
    //       failed_count: failedCount,
    //       total_rows_processed: rows.length,
    //     },
    //     failed_rows: failedRows,
    //     partial_success: true,
    //     school: SchoolModel.sanitizeSchool(updatedSchool!),
    //   });
    //   return;
    // }

    res.status(200).json({
      success: true,
      message,
      summary: {
        created_count: createdCount,
        // updated_count: updatedCount,
        failed_count: failedCount,
        total_rows_processed: rows.length,
      },
      failed_rows: failedRows,
      partial_success: failedCount > 0,
      school: SchoolModel.sanitizeSchool(school),
      // school: SchoolModel.sanitizeSchool(updatedSchool!),
      // warnings: [],
    });
  }
  //   catch (error) {
  //     console.log("______________________Error::::::::", error);
  //     await client.query("ROLLBACK");
  //     next(error);
  //   } finally {
  //     client.release();
  //   }
  // }
);

/**
 * @route   GET /api/v1/auth/onboarding/school-teachers
 * @desc    Get teachers for the school attached to the logged-in user
 * @access  Private
 */
export const getSchoolTeacher = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) throw createError("User not authenticated", 401);

    // Get the logged-in user's details
    const user = await UserModel.findById(req.user.id);

    if (!user) throw createError("User not found", 404);

    // Check if user has a school_id attached
    if (!user.school_id) {
      res.status(400).json({
        success: false,
        message: "No school onboarded yet",
        has_school: false,
      });
      return;
    }

    // Get the school details
    const school = await SchoolModel.findById(user.school_id);

    if (!school) {
      res.status(400).json({
        success: false,
        message: "No school attached",
        has_school: false,
      });
      return;
    }

    // Get teachers for the school
    const teachers = await UserModel.findTeachersBySchoolId(school.id);

    res.status(200).json({
      success: true,
      has_school: true,
      school: SchoolModel.sanitizeSchool(school),
      data: teachers.map(UserModel.sanitizeUser),
    });
  }
);
