import express from "express";
import cors from "cors";

import documentRoutes from "./routes/documentRoutes";
import healthRoutes from "./routes/healthRoutes";
import { errorMiddleware } from "./middlewares/errorMiddleware";

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use("/api", documentRoutes);
app.use("/", healthRoutes);

app.use("*", (req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

app.use(errorMiddleware);

export default app;