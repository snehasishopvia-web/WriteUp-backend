import { Request, Response, NextFunction } from "express";
import { asyncHandler, createError } from "@/middleware/error.middleware";
import { DepartmentModel } from "../models/department.model.js";

/**
 * @route   GET /api/v1/departments
 * @desc    Get all departments for admin's school
 * @access  Private (Admin only)
 */
export const getAllDepartments = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) throw createError("User not authenticated", 401);

    let schoolId: string = req.query.schoolId as string || req.schoolId as string;

    if (!schoolId || typeof schoolId !== "string")
        throw createError("Missing / Invalid requried field school ID.", 404);

    // if (!req.schoolId)
    //   throw createError("School not found", 404);

    const departments = await DepartmentModel.findAll(schoolId);

    res.status(200).json({
      success: true,
      data: departments,
      count: departments.length,
    });
  }
);

/**
 * @route   GET /api/v1/departments/:id
 * @desc    Get department by ID
 * @access  Private (Admin only)
 */
export const getDepartmentById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) throw createError("User not authenticated", 401);

    const { id } = req.params;

    if (!id) throw createError("Department ID is required", 400);

    if (!req.schoolId && !req.isSysAdmin)
      throw createError("School not found", 404);

    const department = await DepartmentModel.findById(
      id,
      req.schoolId || undefined
    );
    if (!department) throw createError("Department not found", 404);

    res.status(200).json({
      success: true,
      data: department,
    });
  }
);

/**
 * @route   POST /api/v1/departments
 * @desc    Create new department
 * @access  Private (Admin only)
 */
export const createDepartment = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) throw createError("User not authenticated", 401);

    const { name, code, description, head_id } = req.body;

    if (!name || name.trim().length < 2)
      throw createError("Department name must be at least 2 characters", 400);

    if (!req.schoolId) throw createError("School not found", 404);

    if (code) {
      const existing = await DepartmentModel.findByCode(code, req.schoolId);
      if (existing)
        throw createError(`Department with code "${code}" already exists`, 409);
    }

    const department = await DepartmentModel.create(req.schoolId, {
      name: name.trim(),
      code: code?.trim(),
      description: description?.trim(),
      head_id,
    });

    res.status(201).json({
      success: true,
      message: "Department created successfully",
      data: department,
    });
  }
);

/**
 * @route   PUT /api/v1/departments/:id
 * @desc    Update department
 * @access  Private (Admin only)
 */
export const updateDepartment = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) throw createError("User not authenticated", 401);

    const { id } = req.params;
    const { name, code, description, head_id, is_active } = req.body;

    if (!id) throw createError("Department ID is required", 400);

    if (!req.schoolId) throw createError("School not found", 404);

    const existing = await DepartmentModel.findById(id, req.schoolId);
    if (!existing) throw createError("Department not found", 404);

    if (code && code !== existing.code) {
      const codeExists = await DepartmentModel.findByCode(code, req.schoolId);
      if (codeExists)
        throw createError(`Department with code "${code}" already exists`, 409);
    }

    const department = await DepartmentModel.update(id, req.schoolId, {
      name: name?.trim(),
      code: code?.trim(),
      description: description?.trim(),
      head_id,
      is_active,
    });

    res.status(200).json({
      success: true,
      message: "Department updated successfully",
      data: department,
    });
  }
);

/**
 * @route   DELETE /api/v1/departments/:id
 * @desc    Delete department (soft delete)
 * @access  Private (Admin only)
 */
export const deleteDepartment = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) throw createError("User not authenticated", 401);

    const { id } = req.params;

    if (!id) throw createError("Department ID is required", 400);
    if (!req.schoolId) throw createError("School not found", 404);

    const existing = await DepartmentModel.findById(id, req.schoolId);
    if (!existing) throw createError("Department not found", 404);

    const deleted = await DepartmentModel.delete(id, req.schoolId);

    if (!deleted) throw createError("Failed to delete department", 500);

    res.status(200).json({
      success: true,
      message: "Department deleted successfully",
    });
  }
);

/**
 * @route   POST /api/v1/departments/sync
 * @desc    Bulk sync departments for a school (create new, delete removed)
 * @access  Private (Admin only)
 */
export const syncDepartments = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) throw createError("User not authenticated", 401);

    const { school_id, departments } = req.body;

    // Validate inputs
    if (!school_id || typeof school_id !== "string")
      throw createError("School ID is required", 400);

    if (!Array.isArray(departments))
      throw createError("Departments must be an array", 400);

    // Validate each department name
    const validDepartments = departments.filter(
      (name) => typeof name === "string" && name.trim().length >= 2
    );

    if (validDepartments.length === 0)
      throw createError(
        "At least one valid department name (minimum 2 characters) is required",
        400
      );

    // Perform bulk sync
    const result = await DepartmentModel.syncDepartments(
      school_id,
      validDepartments
    );

    res.status(200).json({
      success: true,
      message: `Successfully synced departments: ${result.created.length} created, ${result.deleted} deleted`,
      data: {
        created: result.created,
        deletedCount: result.deleted,
        total: validDepartments.length,
      },
    });
  }
);
