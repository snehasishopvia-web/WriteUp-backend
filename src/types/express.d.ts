import { School } from "./school.types";
import { Account } from "./account.types";

declare global {
  namespace Express {
    interface Request {
      roleId?: string;
      emp_id?: string;
      name?: string;
      profile_image?: string;
      email?: string;
      sql_id: number;
      // userId?: string;
      user?: {
        id: string;
        email: string | null;
        userType?: string;
        user_type?: string;
      };
      // Multi-tenant fields
      schoolId?: string | null;
      school?: School;
      isSysAdmin?: boolean;
      // Account-based auth context
      accountId?: string;
      account?: Account;
    }
  }
}

export {};
