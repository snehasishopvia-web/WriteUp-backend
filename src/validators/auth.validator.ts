import { body } from "express-validator";

export const registerValidator = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
  body("password_confirm")
    .exists()
    .withMessage("Password confirmation is required"),
  body("first_name")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 150 })
    .withMessage("First name must be between 1 and 150 characters"),
  body("last_name")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 150 })
    .withMessage("Last name must be between 1 and 150 characters"),
  body("phone")
    .optional({ checkFalsy: true })
    .matches(
      /^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/
    )
    .withMessage("Please provide a valid phone number"),
  body("date_of_birth")
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage("Please provide a valid date"),
];

export const loginValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email or username is required")
    .custom((value) => {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      const isUsername = /^[a-zA-Z0-9_.\-\s]+$/.test(value);
      if (!isEmail && !isUsername) {
        throw new Error("Please provide a valid email or username");
      }
      return true;
    }),
  body("password").notEmpty().withMessage("Password is required"),
];

export const refreshTokenValidator = [
  body("refresh")
    .exists()
    .withMessage("Refresh token is required")
    .isString()
    .withMessage("Refresh token must be a string"),
];

export const logoutValidator = [
  body("refresh")
    .exists()
    .withMessage("Refresh token is required")
    .isString()
    .withMessage("Refresh token must be a string"),
];

export const updateProfileValidator = [
  body("first_name")
    .optional()
    .trim()
    .isLength({ min: 1, max: 150 })
    .withMessage("First name must be between 1 and 150 characters"),
  body("last_name")
    .optional()
    .trim()
    .isLength({ min: 0, max: 150 })
    .withMessage("Last name must be between 1 and 150 characters"),
  body("phone")
    .optional()
    .matches(
      /^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/
    )
    .withMessage("Please provide a valid phone number"),
  body("date_of_birth")
    .optional()
    .isISO8601()
    .withMessage("Please provide a valid date"),
  body("gender")
    .optional()
    .isIn(["male", "female", "other"])
    .withMessage("Gender must be either male, female, or other"),
  body("timezone")
    .optional()
    .isString()
    .withMessage("Timezone must be a string"),
  body("language")
    .optional()
    .isLength({ min: 2, max: 10 })
    .withMessage("Language code must be between 2 and 10 characters"),
];

export const passwordResetRequestValidator = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail({ gmail_remove_dots: false }),
];

export const passwordResetValidator = [
  body("token")
    .exists()
    .withMessage("Reset token is required")
    .isString()
    .withMessage("Reset token must be a string"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
  body("password_confirm")
    .exists()
    .withMessage("Password confirmation is required"),
];
