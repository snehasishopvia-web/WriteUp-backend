const shorthands = undefined;

function normalizeSemester(semester) {
  if (!semester) return semester;

  const cleaned = semester.replace(/´/g, "'").trim();

  const newFormatMatch = cleaned.match(/^(Fall|Spring|Q[1-4]|Summer|Winter)\s+(\d{4})$/);
  if (newFormatMatch) {
    return cleaned;
  }

  const oldFormatMatch1 = cleaned.match(/^(Fall|Spring|Q[1-4]|Summer|Winter)\s+['']?(\d{2})['']?\s*[-–—]\s*['']?(\d{2})['']?/);
  if (oldFormatMatch1) {
    const [, term, year1, year2] = oldFormatMatch1;
    const fullYear1 = parseInt(`20${year1}`);
    const fullYear2 = parseInt(`20${year2}`);
    
    if (term === "Fall" || term === "Q1" || term === "Q2") {
      return `${term} ${fullYear1}`;
    } else if (term === "Spring" || term === "Q3" || term === "Q4") {
      return `${term} ${fullYear2}`;
    } else {
      return `${term} ${fullYear1}`;
    }
  }

  const oldFormatMatch2 = cleaned.match(/^(Fall|Spring|Q[1-4]|Summer|Winter)\s+(\d{2})\s*[-–—]\s*(\d{2})['']?/);
  if (oldFormatMatch2) {
    const [, term, year1, year2] = oldFormatMatch2;
    const fullYear1 = parseInt(`20${year1}`);
    const fullYear2 = parseInt(`20${year2}`);
    
    if (term === "Fall" || term === "Q1" || term === "Q2") {
      return `${term} ${fullYear1}`;
    } else if (term === "Spring" || term === "Q3" || term === "Q4") {
      return `${term} ${fullYear2}`;
    } else {
      return `${term} ${fullYear1}`;
    }
  }

  const yearlyMatch = cleaned.match(/^(\d{4})\s*[-–—]\s*(\d{4})['']?$/);
  if (yearlyMatch) {
    const [, year1, year2] = yearlyMatch;
    return `${year1}-${year2}`;
  }

  const customMatch = cleaned.match(/^(.+?)\s+(\d{2,4})/);
  if (customMatch) {
    const [, term, year] = customMatch;
    const fullYear = year.length === 2 ? parseInt(`20${year}`) : parseInt(year);
    return `${term} ${fullYear}`;
  }

  return cleaned;
}

const up = async (pgm) => {
  const result = await pgm.db.query(`
    SELECT DISTINCT semester 
    FROM classes 
    WHERE semester IS NOT NULL AND semester != ''
  `);

  for (const row of result.rows) {
    const oldSemester = row.semester;
    const newSemester = normalizeSemester(oldSemester);
    
    if (oldSemester !== newSemester) {
      await pgm.db.query(
        `UPDATE classes SET semester = $1 WHERE semester = $2`,
        [newSemester, oldSemester]
      );
    }
  }
};

const down = async (pgm) => {
};

module.exports = { up, down, shorthands };

