import { Request, Response, NextFunction } from "express";
import { asyncHandler, createError } from "../middleware/error.middleware.js";
import { TeacherProfileModel } from "../models/teacher-profile.model.js";
import { StudentProfileModel } from "../models/student-profile.model.js";
import {
  CreateTeacherProfileDTO,
  UpdateTeacherProfileDTO,
  CreateStudentProfileDTO,
  UpdateStudentProfileDTO,
} from "../types/profile.types.js";

export class ProfileController {
  /**
   * Get teacher profile by user ID
   * @route   GET /api/v1/profiles/teacher/:userId
   * @access  Private
   */
  static getTeacherProfile = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const { userId } = req.params;
      const schoolId = req.schoolId;

      if (!userId) {
        throw createError("User ID is required", 400);
      }

      if (!schoolId) {
        throw createError("School ID is required", 403);
      }

      const profile = await TeacherProfileModel.findByUserId(userId);

      if (!profile) {
        throw createError("Teacher profile not found", 404);
      }

      // Verify profile belongs to the same school
      if (profile.school_id !== schoolId) {
        throw createError("Access denied", 403);
      }

      res.status(200).json({
        success: true,
        data: profile,
      });
    }
  );

  /**
   * Get all teacher profiles for a school
   * @route   GET /api/v1/profiles/teachers
   * @access  Private
   */
  static getAllTeacherProfiles = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const schoolId = req.schoolId;
      const activeOnly = req.query.active_only !== "false";

      if (!schoolId) {
        throw createError("School ID is required", 403);
      }

      const profiles = await TeacherProfileModel.findAll(schoolId, activeOnly);

      res.status(200).json({
        success: true,
        data: profiles,
        count: profiles.length,
      });
    }
  );

  /**
   * Create teacher profile
   * @route   POST /api/v1/profiles/teacher
   * @access  Private
   */
  static createTeacherProfile = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const schoolId = req.schoolId;
      const data: CreateTeacherProfileDTO = req.body;

      if (!schoolId) {
        throw createError("School ID is required", 403);
      }

      // Validate required fields
      if (!data.user_id || !data.employee_id || !data.qualification || !data.join_date) {
        throw createError(
          "user_id, employee_id, qualification, and join_date are required",
          400
        );
      }

      // Check if profile already exists
      const existing = await TeacherProfileModel.findByUserId(data.user_id);
      if (existing) {
        throw createError("Teacher profile already exists for this user", 409);
      }

      // Check if employee ID is unique in school
      const employeeExists = await TeacherProfileModel.findByEmployeeId(
        data.employee_id,
        schoolId
      );
      if (employeeExists) {
        throw createError("Employee ID already exists in this school", 409);
      }

      const profile = await TeacherProfileModel.create(schoolId, data);

      res.status(201).json({
        success: true,
        message: "Teacher profile created successfully",
        data: profile,
      });
    }
  );

  /**
   * Update teacher profile
   * @route   PUT /api/v1/profiles/teacher/:id
   * @access  Private
   */
  static updateTeacherProfile = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const { id } = req.params;
      const schoolId = req.schoolId;
      const data: UpdateTeacherProfileDTO = req.body;

      if (!id) {
        throw createError("Profile ID is required", 400);
      }

      if (!schoolId) {
        throw createError("School ID is required", 403);
      }

      // Check if profile exists and belongs to school
      const existing = await TeacherProfileModel.findById(id, schoolId);
      if (!existing) {
        throw createError("Teacher profile not found", 404);
      }

      // If updating employee ID, check for uniqueness
      if (data.employee_id && data.employee_id !== existing.employee_id) {
        const employeeExists = await TeacherProfileModel.findByEmployeeId(
          data.employee_id,
          schoolId
        );
        if (employeeExists) {
          throw createError("Employee ID already exists in this school", 409);
        }
      }

      const profile = await TeacherProfileModel.update(id, schoolId, data);

      res.status(200).json({
        success: true,
        message: "Teacher profile updated successfully",
        data: profile,
      });
    }
  );

  /**
   * Delete teacher profile
   * @route   DELETE /api/v1/profiles/teacher/:id
   * @access  Private
   */
  static deleteTeacherProfile = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const { id } = req.params;
      const schoolId = req.schoolId;

      if (!id) {
        throw createError("Profile ID is required", 400);
      }

      if (!schoolId) {
        throw createError("School ID is required", 403);
      }

      const deleted = await TeacherProfileModel.delete(id, schoolId);

      if (!deleted) {
        throw createError("Teacher profile not found", 404);
      }

      res.status(200).json({
        success: true,
        message: "Teacher profile deleted successfully",
      });
    }
  );

  /**
   * Get student profile by user ID
   * @route   GET /api/v1/profiles/student/:userId
   * @access  Private
   */
  static getStudentProfile = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const { userId } = req.params;
      const schoolId = req.schoolId;

      if (!userId) {
        throw createError("User ID is required", 400);
      }

      if (!schoolId) {
        throw createError("School ID is required", 403);
      }

      const profile = await StudentProfileModel.findByUserId(userId);

      if (!profile) {
        throw createError("Student profile not found", 404);
      }

      // Verify profile belongs to the same school
      if (profile.school_id !== schoolId) {
        throw createError("Access denied", 403);
      }

      res.status(200).json({
        success: true,
        data: profile,
      });
    }
  );

  /**
   * Get all student profiles for a school
   * @route   GET /api/v1/profiles/students
   * @access  Private
   */
  static getAllStudentProfiles = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const schoolId = req.schoolId;
      const activeOnly = req.query.active_only !== "false";
      const status = req.query.status as any;

      if (!schoolId) {
        throw createError("School ID is required", 403);
      }

      const profiles = await StudentProfileModel.findAll(
        schoolId,
        activeOnly,
        status
      );

      res.status(200).json({
        success: true,
        data: profiles,
        count: profiles.length,
      });
    }
  );

  /**
   * Create student profile
   * @route   POST /api/v1/profiles/student
   * @access  Private
   */
  static createStudentProfile = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const schoolId = req.schoolId;
      const data: CreateStudentProfileDTO = req.body;

      if (!schoolId) {
        throw createError("School ID is required", 403);
      }

      // Validate required fields
      if (!data.user_id || !data.admission_number || !data.admission_date) {
        throw createError(
          "user_id, admission_number, and admission_date are required",
          400
        );
      }

      // Check if profile already exists
      const existing = await StudentProfileModel.findByUserId(data.user_id);
      if (existing) {
        throw createError("Student profile already exists for this user", 409);
      }

      // Check if admission number is unique in school
      const admissionExists = await StudentProfileModel.findByAdmissionNumber(
        data.admission_number,
        schoolId
      );
      if (admissionExists) {
        throw createError("Admission number already exists in this school", 409);
      }

      const profile = await StudentProfileModel.create(schoolId, data);

      res.status(201).json({
        success: true,
        message: "Student profile created successfully",
        data: profile,
      });
    }
  );

  /**
   * Update student profile
   * @route   PUT /api/v1/profiles/student/:id
   * @access  Private
   */
  static updateStudentProfile = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const { id } = req.params;
      const schoolId = req.schoolId;
      const data: UpdateStudentProfileDTO = req.body;

      if (!id) {
        throw createError("Profile ID is required", 400);
      }

      if (!schoolId) {
        throw createError("School ID is required", 403);
      }

      // Check if profile exists and belongs to school
      const existing = await StudentProfileModel.findById(id, schoolId);
      if (!existing) {
        throw createError("Student profile not found", 404);
      }

      // If updating admission number, check for uniqueness
      if (data.admission_number && data.admission_number !== existing.admission_number) {
        const admissionExists = await StudentProfileModel.findByAdmissionNumber(
          data.admission_number,
          schoolId
        );
        if (admissionExists) {
          throw createError("Admission number already exists in this school", 409);
        }
      }

      const profile = await StudentProfileModel.update(id, schoolId, data);

      res.status(200).json({
        success: true,
        message: "Student profile updated successfully",
        data: profile,
      });
    }
  );

  /**
   * Delete student profile
   * @route   DELETE /api/v1/profiles/student/:id
   * @access  Private
   */
  static deleteStudentProfile = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const { id } = req.params;
      const schoolId = req.schoolId;

      if (!id) {
        throw createError("Profile ID is required", 400);
      }

      if (!schoolId) {
        throw createError("School ID is required", 403);
      }

      const deleted = await StudentProfileModel.delete(id, schoolId);

      if (!deleted) {
        throw createError("Student profile not found", 404);
      }

      res.status(200).json({
        success: true,
        message: "Student profile deleted successfully",
      });
    }
  );

  /**
   * Get students by class
   * @route   GET /api/v1/profiles/students/class/:classId
   * @access  Private
   */
  static getStudentsByClass = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const { classId } = req.params;
      const schoolId = req.schoolId;

      if (!classId) {
        throw createError("Class ID is required", 400);
      }

      if (!schoolId) {
        throw createError("School ID is required", 403);
      }

      const profiles = await StudentProfileModel.findByClass(classId, schoolId);

      res.status(200).json({
        success: true,
        data: profiles,
        count: profiles.length,
      });
    }
  );

  /**
   * Get teachers by department
   * @route   GET /api/v1/profiles/teachers/department/:departmentId
   * @access  Private
   */
  static getTeachersByDepartment = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const { departmentId } = req.params;
      const schoolId = req.schoolId;

      if (!departmentId) {
        throw createError("Department ID is required", 400);
      }

      if (!schoolId) {
        throw createError("School ID is required", 403);
      }

      const profiles = await TeacherProfileModel.findByDepartment(
        departmentId,
        schoolId
      );

      res.status(200).json({
        success: true,
        data: profiles,
        count: profiles.length,
      });
    }
  );
}
