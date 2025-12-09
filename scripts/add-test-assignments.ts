import { pool } from "../src/config/postgres.db.js";

async function addTestAssignments() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // First, get a user ID to use as created_by (get the first user from the database)
    const userResult = await client.query("SELECT id FROM users LIMIT 1");

    if (userResult.rows.length === 0) {
      console.log("❌ No users found in database. Please create a user first.");
      await client.query("ROLLBACK");
      return;
    }

    const userId = userResult.rows[0].id;
    console.log(`Using user ID: ${userId}`);

    // Get or create a test school
    let schoolResult = await client.query(
      "SELECT id FROM schools WHERE name = $1",
      ["Rhode Island School of Design"]
    );

    let schoolId;
    if (schoolResult.rows.length === 0) {
      const newSchool = await client.query(
        `INSERT INTO schools (name, school_type, class_structure_type, timezone, admin_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        ["Rhode Island School of Design", "college-university-4", "semester", "America/New_York", userId]
      );
      schoolId = newSchool.rows[0].id;
      console.log(`Created test school with ID: ${schoolId}`);
    } else {
      schoolId = schoolResult.rows[0].id;
      console.log(`Using existing school ID: ${schoolId}`);
    }

    // Get or create a test department
    let deptResult = await client.query(
      "SELECT id FROM departments WHERE name = $1 AND school_id = $2",
      ["Architecture", schoolId]
    );

    let departmentId;
    if (deptResult.rows.length === 0) {
      const newDept = await client.query(
        `INSERT INTO departments (name, code, school_id)
         VALUES ($1, $2, $3) RETURNING id`,
        ["Architecture", "ARCH", schoolId]
      );
      departmentId = newDept.rows[0].id;
      console.log(`Created test department with ID: ${departmentId}`);
    } else {
      departmentId = deptResult.rows[0].id;
      console.log(`Using existing department ID: ${departmentId}`);
    }

    // Get or create a test class
    let classResult = await client.query(
      "SELECT id FROM classes WHERE class_name = $1 AND school_id = $2",
      ["Architecture History", schoolId]
    );

    let classId;
    if (classResult.rows.length === 0) {
      const newClass = await client.query(
        `INSERT INTO classes (class_name, school_id, creator_id, department_id, semester, status)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        ["Architecture History", schoolId, userId, departmentId, "Fall 2026", "active"]
      );
      classId = newClass.rows[0].id;
      console.log(`Created test class with ID: ${classId}`);
    } else {
      classId = classResult.rows[0].id;
      console.log(`Using existing class ID: ${classId}`);
    }

    // Create test assignments
    const assignments = [
      {
        title: "Mid Term Paper",
        description: "Lorem ipsum dolor sit amet consectetur. Aliquam et vitae malesuada nunc sapien tincidunt suspendisse. Laoreet aliquet nec tristique cras vitae nec sit lacus vestibulum. Facilisi pellentesque venenatis in ultrices. Mi sem mauris tempor velit suspendisse massa feugiat nunc. Dictum interdum dolor ultricies vitae in tempus sed nulla. Gravida in proin eu ut.\n\nGravida quisque felis magna pellentesque vitae commodo vitae ut dui. Morbi laoreet sapien purus pretium venenatis facilisi rutrum. Proin adipiscing ultricies non dolor maecenas. Suspendisse non risus tellus quis venenatis senectus nec dictumst. Turpis euismod libero adipiscing scelerisque a elementum enim. Nibh aliquam nulla varius ut cras nunc proin. Ultricies nisl tellus ut proin elit. Metus id iaculis proin purus justo.",
        assign_date: new Date("2025-01-15"),
        due_date: new Date("2025-04-10"),
        max_score: 100,
        min_word_count: 1500,
        max_word_count: 3000,
        page_count: 5,
        citation_style: "mla",
        assignment_type: "Research Paper",
        allow_late_submission: false,
        status: "active",
      },
      {
        title: "Assignment 1",
        description: "Introduction to Renaissance architecture. Research and analyze the key characteristics and influential architects of the period.",
        assign_date: new Date("2025-01-20"),
        due_date: new Date("2025-04-09"),
        max_score: 100,
        min_word_count: 1000,
        max_word_count: 2000,
        citation_style: "apa",
        assignment_type: "Essay",
        allow_late_submission: true,
        status: "active",
      },
      {
        title: "Final Assignment",
        description: "Comprehensive analysis of architectural movements throughout history. This assignment should demonstrate your understanding of the course material.",
        assign_date: new Date("2025-03-01"),
        due_date: new Date("2025-04-10"),
        max_score: 150,
        min_word_count: 3000,
        max_word_count: 5000,
        page_count: 10,
        citation_style: "chicago",
        assignment_type: "Final Paper",
        allow_late_submission: false,
        status: "active",
        grading_criteria: {
          research: 30,
          analysis: 40,
          writing: 20,
          citations: 10,
        },
      },
    ];

    for (const assignment of assignments) {
      const result = await client.query(
        `INSERT INTO assignments (
          title, description, class_id, created_by, school_id,
          assign_date, due_date, max_score, min_word_count,
          max_word_count, page_count, assignment_type, citation_style,
          allow_late_submission, status, grading_criteria
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        ) RETURNING id, title`,
        [
          assignment.title,
          assignment.description,
          classId,
          userId,
          schoolId,
          assignment.assign_date,
          assignment.due_date,
          assignment.max_score,
          assignment.min_word_count || null,
          assignment.max_word_count || null,
          assignment.page_count || null,
          assignment.assignment_type || null,
          assignment.citation_style || null,
          assignment.allow_late_submission,
          assignment.status,
          assignment.grading_criteria ? JSON.stringify(assignment.grading_criteria) : null,
        ]
      );

      console.log(`✅ Created assignment: ${result.rows[0].title} (ID: ${result.rows[0].id})`);
    }

    await client.query("COMMIT");
    console.log("\n✅ Successfully added test assignments!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Error adding test assignments:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addTestAssignments()
  .then(() => {
    console.log("\n✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });
