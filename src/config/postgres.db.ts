import { Pool } from "pg";
import "dotenv/config";
import { existsSync } from "fs";
import { join } from "path";

const isProduction = process.env.NODE_ENV === "production";

// Determine where environment variables came from
const envPath = join(process.cwd(), '.env');
let envSource = 'system environment variables';
if (!isProduction && existsSync(envPath)) {
  envSource = '.env file';
} else if (isProduction) {
  envSource = 'system environment variables (production)';
}

// Check if DATABASE_URL requires SSL (has sslmode or uses cloud providers)
const databaseUrl = process.env.DATABASE_URL || '';
const requiresSSL = databaseUrl.includes('sslmode=require') ||
                    databaseUrl.includes('.aivencloud.com') ||
                    databaseUrl.includes('.render.com') ||
                    databaseUrl.includes('ssl=true');

// Log database configuration on startup
const dbHost = databaseUrl.split('@')[1]?.split('/')[0] || 'unknown';
console.log(`\n🔍 Database Configuration:`);
console.log(`   Mode: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
console.log(`   Environment source: ${envSource}`);
console.log(`   Host: ${dbHost}`);
console.log(`   SSL: ${requiresSSL ? 'Enabled' : 'Disabled'}\n`);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: requiresSSL
    ? {
        rejectUnauthorized: false,
      }
    : false,
});

pool.on("connect", () => {
  console.log("✅ Connected to PostgreSQL");
});

pool.on("error", (err: unknown) => {
  console.error("❌ Unexpected DB error", err);
  process.exit(-1);
});
