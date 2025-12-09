import "dotenv/config";
import { pool } from "../src/config/postgres.db.js";
import { SchoolModel } from "../src/models/school.model.js";
import { UserModel } from "../src/models/user.model.js";
import { SchoolType, ClassStructureType } from "../src/types/school.types.js";
import bcrypt from "bcryptjs";

const createStudentWithSchool = async () => {
  console.log("🚀 Starting script: Create Student with School...");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // --- 1. Create a dummy Admin User ---
    console.log("   - Creating a dummy admin user...");
    const adminEmail = `admin-${Date.now()}@test.com`;
    const adminPassword = "Password123!";
    const hashedAdminPassword = await bcrypt.hash(adminPassword, 12);

    const adminResult = await client.query(
      `INSERT INTO users (email, username, password, first_name, last_name, user_type, is_active)
       VALUES ($1, $1, $2, 'Dummy', 'Admin', 'admin', true)
       RETURNING id`,
      [adminEmail, hashedAdminPassword]
    );
    const adminId = adminResult.rows[0].id;
    console.log(`   ✅ Dummy admin created with ID: ${adminId}`);


    // --- 2. Create a School ---
    console.log("   - Creating a new school...");
    const schoolData = {
      name: "Temporary Test School",
      school_type: SchoolType.COLLEGE_UNIVERSITY_4,
      class_structure_type: ClassStructureType.SEMESTER,
      timezone: "America/New_York",
    };
    const { school, created } = await SchoolModel.createOrUpdate(
      adminId, // Use the new admin's ID
      schoolData,
      client
    );
    console.log(`   ✅ School "${school.name}" created with ID: ${school.id}`);

    // --- 3. Create a Student User ---
    console.log("   - Creating a new student user...");
    const studentPassword = "Password123!";
    const hashedPassword = await bcrypt.hash(studentPassword, 12);
    const studentEmail = `student-${Date.now()}@test.com`;

    const studentData = {
      email: studentEmail,
      password: hashedPassword,
      first_name: "Test",
      last_name: "Student",
      user_type: "student" as const,
      school_id: school.id, // Associate user with the new school
    };

    const studentResult = await client.query(
      `INSERT INTO users (email, username, password, first_name, last_name, user_type, school_id, is_active)
       VALUES ($1, $1, $2, $3, $4, $5, $6, true)
       RETURNING *`,
      [
        studentData.email,
        studentData.password,
        studentData.first_name,
        studentData.last_name,
        studentData.user_type,
        studentData.school_id,
      ]
    );

    const student = studentResult.rows[0];
    console.log(`   ✅ Student "${student.email}" created with ID: ${student.id}`);
    console.log(`   🔑 Password: ${studentPassword}`);


    await client.query("COMMIT");

    console.log("\n🎉 Success! A new student and school have been created.");
    console.log("--------------------------------------------------");
    console.log("Login Credentials:");
    console.log(`   Email:    ${studentData.email}`);
    console.log(`   Password: ${studentPassword}`);
    console.log("--------------------------------------------------");

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("\n❌ An error occurred. Rolling back changes.");
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    console.log("\n🏁 Script finished.");
  }
};

createStudentWithSchool().catch(error => {
  console.error("Critical error running script:", error);
  process.exit(1);
});
