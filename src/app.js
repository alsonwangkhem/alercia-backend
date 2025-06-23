import express from "express";
import cors from "cors";

import documentRoutes from "./routes/documentRoutes.js";//add .js for type module
import healthRoutes from "./routes/healthRoutes.js";
import { errorMiddleware } from "./middlewares/errorMiddleware.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use("/api", documentRoutes);
app.use("/", healthRoutes);

app.use('/:wildcard(*)', (req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

app.use(errorMiddleware);

export default app;