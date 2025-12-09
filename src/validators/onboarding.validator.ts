import { body } from "express-validator";
import { SchoolType, ClassStructureType } from "../types/school.types.js";

const validSchoolTypes = Object.values(SchoolType);
const validClassStructures = Object.values(ClassStructureType);

export const saveOnboardingDataValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("School name is required")
    .isLength({ min: 2 })
    .withMessage("School name must be at least 2 characters"),
  body("school_type")
    .notEmpty()
    .withMessage("School type is required")
    .isIn(validSchoolTypes)
    .withMessage("Invalid school type"),
  body("class_structure_type")
    .notEmpty()
    .withMessage("Class structure type is required")
    .isIn(validClassStructures)
    .withMessage("Invalid class structure type"),
  body("additional_programs")
    .optional()
    .isArray()
    .withMessage("Additional programs must be an array"),
];

export const saveProgramsValidator = [
  body("additional_programs")
    .isArray()
    .withMessage("Additional programs must be an array"),
];

export const completeStepValidator = [
  body("step")
    .notEmpty()
    .withMessage("Step is required")
    .isIn(["teachers", "students", "complete"])
    .withMessage("Step must be 'teachers', 'students', or 'complete'"),
  body("completed").isBoolean().withMessage("Completed must be a boolean"),
];
