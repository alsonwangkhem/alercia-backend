import express from "express";
import upload from "../middlewares/uploadMiddleware.js";
import { processDocument } from "../controllers/documentController.js";

const documentRoutes = express.Router();

// TODO: .fields or .array 
documentRoutes.post('/process-document', upload.single('file'), processDocument);

export default documentRoutes;