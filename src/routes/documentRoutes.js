import express from "express";
import upload from "../middlewares/uploadMiddleware.js";
import { processDocument } from "../controllers/documentController.js";

const documentRoutes = express.Router();

// TODO: .fields or .array 
documentRoutes.post('/process-document', upload.array('file', 5), processDocument);
export default documentRoutes;