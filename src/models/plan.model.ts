import { pool } from "../config/postgres.db.js";
import { QueryResult } from "pg";

export interface Plan {
  id?: string;
  name: string;
  slug: string;
  description?: string;
  price_monthly: number;
  price_yearly: number;
  max_schools?: number;
  max_students_per_school?: number;
  max_teachers_per_school?: number;
  max_classes_per_school?: number;
  max_storage_gb?: number;
  allow_custom_branding?: boolean;
  allow_api_access?: boolean;
  allow_advanced_reports?: boolean;
  allow_parent_portal?: boolean;
  display_order?: number;
  is_featured?: boolean;
  is_active?: boolean;
  features?: string[];
  created_at?: Date;
  updated_at?: Date;
  stripe_monthly_price_id: string;
  stripe_yearly_price_id: string;
  extra_student_price_monthly?: number;
  extra_student_price_yearly?: number;
  extra_teacher_price_monthly?: number;
  extra_teacher_price_yearly?: number;
}

export class PlanModel {
  /**
   * Create a new plan
   */
  static async create(planData: Plan): Promise<Plan | undefined> {
    const {
      name,
      slug,
      description,
      price_monthly,
      price_yearly,
      max_schools = 1,
      max_students_per_school = 100,
      max_teachers_per_school = 20,
      max_classes_per_school = 10,
      max_storage_gb = 5,
      allow_custom_branding = false,
      allow_api_access = false,
      allow_advanced_reports = false,
      allow_parent_portal = false,
      display_order = 0,
      is_featured = false,
      is_active = true,
      features = [],
    } = planData;

  
const query = `
INSERT INTO plans (
  name, slug, description, price_monthly, price_yearly,
  max_schools, max_students_per_school, max_teachers_per_school,
  max_classes_per_school, max_storage_gb,
  allow_custom_branding, allow_api_access, allow_advanced_reports,
  allow_parent_portal, display_order, is_featured, is_active, features,
  stripe_monthly_price_id, stripe_yearly_price_id
) VALUES (
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
  $11,$12,$13,$14,$15,$16,$17,$18,$19,$20
) RETURNING *
`;

const values = [
  name, slug, description || null, price_monthly, price_yearly,
  max_schools, max_students_per_school, max_teachers_per_school,
  max_classes_per_school, max_storage_gb,
  allow_custom_branding, allow_api_access, allow_advanced_reports,
  allow_parent_portal, display_order, is_featured, is_active,
  JSON.stringify(features),
  planData.stripe_monthly_price_id,
  planData.stripe_yearly_price_id
];

    const result: QueryResult<Plan> = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Get all plans
   */
  static async findAll(activeOnly = true): Promise<Plan[]> {
    const query = activeOnly
      ? "SELECT * FROM plans WHERE is_active = true ORDER BY display_order, price_monthly"
      : "SELECT * FROM plans ORDER BY display_order, price_monthly";

    const result: QueryResult<Plan> = await pool.query(query);
    return result.rows;
  }

  /**
   * Get plan by ID
   */
  static async findById(id: string): Promise<Plan | null> {
    const query = "SELECT * FROM plans WHERE id = $1";
    const result: QueryResult<Plan> = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Get plan by slug
   */
  static async findBySlug(slug: string): Promise<Plan | null> {
    const query = "SELECT * FROM plans WHERE slug = $1";
    const result: QueryResult<Plan> = await pool.query(query, [slug]);
    return result.rows[0] || null;
  }

  /**
   * Update plan
   */
  static async update(
    id: string,
    planData: Partial<Plan>
  ): Promise<Plan | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(planData).forEach(([key, value]) => {
      if (value !== undefined && key !== "id" && key !== "created_at") {
        if (key === "features") value = JSON.stringify(value);
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE plans
      SET ${fields.join(", ")}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result: QueryResult<Plan> = await pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete plan (soft delete)
   */
  static async delete(id: string): Promise<boolean> {
    const query =
      "UPDATE plans SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1";
    const result = await pool.query(query, [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Hard delete plan
   */
  static async hardDelete(id: string): Promise<boolean> {
    const query = "DELETE FROM plans WHERE id = $1";
    const result = await pool.query(query, [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }
}
