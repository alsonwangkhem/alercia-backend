// note set 1 -> multiple questions (generated from files)
import fs from 'fs/promises'
import TextExtractor from '../services/textExtractionService.js';
import MCQGenerator from '../services/mcqGenerationService.js'
import supabase from '../config/supabase.js'

export async function processDocument(req, res) {

  try {
   if (!req.files || req.files.length === 0) {
  return res.status(400).json({ error: "No files uploaded" });
   }

    
    const {
      noteSetName, // eg. physics chapter 1
      noteSetDescription =" ",
      questionCount,
      difficulty = "medium",
      userId,
    } = req.body;

    if (!noteSetName || !userId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    let combinedData = {
    text: '',
    methods: new Set(),
    pages: 0,
    };

    // multiple files handling by looping through it 
  for(const file of req.files){
    console.log(`Processing file: ${file.originalname}`);
    console.log(`File type: ${file.mimetype}`);
    console.log(`File size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
    
    const filePath = file.path;
    // Extract text based on file type
    let extractionResult;

    if (file.mimetype === "application/pdf") {
  extractionResult = await TextExtractor.extractFromPDF(filePath);

} else if (file.mimetype.startsWith("image/")) {
  extractionResult = await TextExtractor.extractFromImage(filePath);

} else if (
  file.mimetype === "application/vnd.ms-powerpoint" || // .ppt
  file.mimetype === "application/vnd.openxmlformats-officedocument.presentationml.presentation" // .pptx
) {
  extractionResult = await TextExtractor.extractFromPPT(filePath); // implement this

} else if (
  file.mimetype === "application/msword" || // .doc
  file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" // .docx
) {
  extractionResult = await TextExtractor.extractFromDOC(filePath); // implement this

} else {
  throw new Error("Unsupported file type");
}


    if (!extractionResult.text || extractionResult.text.trim().length < 50) {
      throw new Error("Insufficient text extracted from document");
    }
    combinedData.text += extractionResult.text;
    combinedData.methods.add(extractionResult.method);
    combinedData.pages += extractionResult.pages || 0;
    console.log(
      `Text extracted (${extractionResult.text.length} characters)`
    );
    console.log(`Method: ${extractionResult.method}`);
    // clean up 
    await fs.unlink(filePath);
  }

     console.log("Combined Extracted result: ",combinedData.text);
    // Generate MCQs
    console.log("Generating MCQs...");
    const mcqResult = await MCQGenerator.generateMCQs(
      combinedData.text,
      parseInt(questionCount),
      difficulty
    );

    console.log(`Generated ${mcqResult.questions.length} MCQs`);

    // Create note set in Supabase
    const { data: noteSet, error: noteSetError } = await supabase
      .from("note_sets")
      .insert([
        {
          user_id: userId,
          name: noteSetName,
          description: noteSetDescription || null,
        },
      ])
      .select()
      .single();

    if (noteSetError) {
      throw new Error(`Failed to create note set: ${noteSetError.message}`);
    }

    console.log(`Created note set: ${noteSet.name}`);

    // Save MCQs to database
    const mcqsToInsert = mcqResult.questions.map((q) => ({
      note_set_id: noteSet.id,
      question: q.question,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
    }));

    const { data: savedMCQs, error: mcqError } = await supabase
      .from("mcq_questions")
      .insert(mcqsToInsert)
      .select();

    if (mcqError) {
      throw new Error(`Failed to save MCQs: ${mcqError.message}`);
    }

    console.log(`Saved ${savedMCQs.length} MCQs to database`);

    // Response
    res.json({
      success: true,
      noteSet: {
        id: noteSet.id,
        name: noteSet.name,
        description: noteSet.description,
        created_at: noteSet.created_at,
      },
      processing: {
        method: combinedData.methods,
        pages: combinedData.pages,
        textLength: combinedData.text.length,
        questionsGenerated: mcqResult.questions.length,
        questionsRequested: parseInt(questionCount),
      },
      questions: savedMCQs,
    });
  } catch (error) {
    console.error("Processing error:", error);
    res.status(500).json({
      error: error.message,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  } 

}
