import express from "express";
import { healthCheck } from "../controllers/healthController.js";

const healthRoutes = express.Router();

healthRoutes.get('/health', healthCheck);

export default healthRoutes;