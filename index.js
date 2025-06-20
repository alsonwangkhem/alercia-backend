import app from "./src/app";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`PDF Processing Server running on port ${PORT}`);
  console.log(`Endpoints:`);
  console.log(`   GET  /health - Health check`);
  console.log(
    `   POST /api/process-document - Process PDF/Image and generate MCQs`
  );
  console.log(
    `Environment: ${process.env.NODE_ENV || "development"}`
  );
});
