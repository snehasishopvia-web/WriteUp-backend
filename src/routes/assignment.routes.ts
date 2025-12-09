import { Router } from "express";
import { AssignmentController } from "../controllers/assignment.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();


router.use(authenticate);

//create assignment
router.post("/", AssignmentController.create);

// get only active assignments
router.get("/active", AssignmentController.listActive);

// get assignments for authenticated student (based on enrolled classes)
router.get("/student", AssignmentController.listForStudent);

//get all the assignment
router.get("/", AssignmentController.list);

//get assignment data by id
router.get("/:id", AssignmentController.getById);

//update the assignment data
router.patch("/:id", AssignmentController.update);

//delete the assignment data(only change the status active to inactive)
router.delete("/:id", AssignmentController.delete);

// Get assignments by class ID
router.get("/class/:class_id", AssignmentController.listByClass);


export default router;
