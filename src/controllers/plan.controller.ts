import { Request, Response, NextFunction } from "express";
import { PlanModel, Plan } from "../models/plan.model.js";
import { createError } from "../middleware/error.middleware.js";
import stripe from "@/config/stripe.js";

/**
 * Create a new plan
 * POST /api/v1/plans
 */

export const createPlan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      name,
      slug,
      description,
      price_monthly,
      price_yearly,
      max_schools,
      max_students_per_school,
      max_teachers_per_school,
      max_classes_per_school,
      max_storage_gb,
      allow_custom_branding,
      allow_api_access,
      allow_advanced_reports,
      allow_parent_portal,
      display_order,
      is_featured,
      is_active,
      features,
    } = req.body;

    // Validation
    if (!name || !slug || price_monthly === undefined || price_yearly === undefined) {
      return next(createError("Name, slug, price_monthly, and price_yearly are required", 400));
    }

    const existingPlan = await PlanModel.findBySlug(slug);
    if (existingPlan)
      return next(createError("A plan with this slug already exists", 409));

    // Create Stripe product
    const product = await stripe.products.create({ name });

    // Create Stripe prices
    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(price_monthly * 100),
      currency: "usd",
      recurring: { interval: "month" },
    });

    const yearlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(price_yearly * 100),
      currency: "usd",
      recurring: { interval: "year" },
    });

    const planData: Plan = {
      name,
      slug,
      description,
      price_monthly: parseFloat(price_monthly),
      price_yearly: parseFloat(price_yearly),
      max_schools,
      max_students_per_school,
      max_teachers_per_school,
      max_classes_per_school,
      max_storage_gb,
      allow_custom_branding,
      allow_api_access,
      allow_advanced_reports,
      allow_parent_portal,
      display_order,
      is_featured,
      is_active: is_active ?? true,
      features: Array.isArray(features) ? features : [],
      stripe_monthly_price_id: monthlyPrice.id,  // auto set
      stripe_yearly_price_id: yearlyPrice.id,    // auto set
    };

    const newPlan = await PlanModel.create(planData);

    res.status(201).json({
      status: "success",
      message: "Plan created successfully",
      data: { plan: newPlan },
    });
  } catch (error: any) {
    console.log("Error creating plan:", error);
    if (error.code === "23505") {
      return next(createError("A plan with this name or slug already exists", 409));
    }
    next(error);
  }
};

/**
 * Get all plans
 * GET /api-v1/plans
 */
export const getAllPlans = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const activeOnly = req.query.active_only !== "false";
    const plans = await PlanModel.findAll(activeOnly);

    res.status(200).json({
      status: "success",
      results: plans.length,
      data: {
        plans,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get plan by ID
 * GET /api-v1/plans/:id
 */
export const getPlanById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) return next(createError("Plan ID is required", 400));
    const plan = await PlanModel.findById(id);

    if (!plan) return next(createError("Plan not found", 404));

    res.status(200).json({
      status: "success",
      data: {
        plan,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get plan by slug
 * GET /api-v1/plans/slug/:slug
 */
export const getPlanBySlug = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { slug } = req.params;
    if (!slug) return next(createError("Plan slug is required", 400));
    const plan = await PlanModel.findBySlug(slug);

    if (!plan) return next(createError("Plan not found", 404));

    res.status(200).json({
      status: "success",
      data: {
        plan,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update plan
 * PUT /api-v1/plans/:id
 */
export const updatePlan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    if (!id) return next(createError("Plan ID is required", 400));

    // Check if plan exists
    const existingPlan = await PlanModel.findById(id);
    if (!existingPlan) return next(createError("Plan not found", 404));

    // If slug is being updated, check if it's unique
    if (updateData.slug && updateData.slug !== existingPlan.slug) {
      const planWithSlug = await PlanModel.findBySlug(updateData.slug);
      if (planWithSlug)
        return next(createError("A plan with this slug already exists", 409));
    }
    if (updateData.features && !Array.isArray(updateData.features)) {
      updateData.features = [];
    }

    const updatedPlan = await PlanModel.update(id, updateData);

    res.status(200).json({
      status: "success",
      message: "Plan updated successfully",
      data: {
        plan: updatedPlan,
      },
    });
  } catch (error: any) {
    if (error.code === "23505")
      return next(
        createError("A plan with this name or slug already exists", 409)
      );

    next(error);
  }
};

/**
 * Delete plan (soft delete)
 * DELETE /api-v1/plans/:id
 */
export const deletePlan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) return next(createError("Plan ID is required", 400));

    const plan = await PlanModel.findById(id);
    if (!plan) return next(createError("Plan not found", 404));

    const deleted = await PlanModel.delete(id);

    if (!deleted) return next(createError("Failed to delete plan", 500));

    res.status(200).json({
      status: "success",
      message: "Plan deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
