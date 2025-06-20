import express from "express";
import upload from "../middlewares/uploadMiddleware";
import { processDocument } from "../controllers/documentController";

const documentRoutes = express.Router();

// TODO: .fields or .array 
documentRoutes.post('/process-document', upload.single('file'), processDocument);

export default documentRoutes;