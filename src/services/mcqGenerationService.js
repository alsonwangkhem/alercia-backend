import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const COHERE_API_URL = "https://api.cohere.ai/v1/chat";

class MCQGenerator {
  static async generateMCQs(text, questionCount = 10, difficulty = "medium") {
    const prompt = `
You are an expert educator creating multiple-choice questions. Based on the following text, generate exactly ${questionCount} high-quality MCQ questions.

Requirements:
- Each question should test understanding, not just memorization
- Provide 4 options (A, B, C, D) where only one is correct
- Include a brief explanation for the correct answer
- Questions should be ${difficulty} difficulty level
- Cover different aspects of the content
- Avoid overly obvious or trick questions

Text to analyze:
${text.substring(0, 8000)} ${text.length > 8000 ? "...(truncated)" : ""}

Respond in this JSON format:
{
  "questions": [
    {
      "question": "text",
      "option_a": "A",
      "option_b": "B",
      "option_c": "C",
      "option_d": "D",
      "correct_answer": "A",
      "explanation": "reason"
    }
  ]
}
Generate exactly ${questionCount} questions.
`;

    try {
      const response = await axios.post(
        COHERE_API_URL,
        {
          model: "command-r-plus", // or "command-r" if needed
          message: prompt,
          temperature: 0.7,
          max_tokens: 2048,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const raw = response.data?.text || response.data?.generations?.[0]?.text;
      if (!raw) throw new Error("Empty or missing response from Cohere");
      console.log("Raw response from Cohere:\n", raw);

      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start === -1 || end === -1) {
      throw new Error("JSON block not found in model output");
      }

      const jsonString = raw.slice(start, end + 1);

      let mcqData;
      try {
        mcqData = JSON.parse(jsonString);
      } catch (err) {
        console.error("JSON parse error:", err);
        throw new Error("Invalid JSON format from Cohere model");
      }

      const validQuestions = mcqData.questions?.filter(
        (q) =>
          q.question &&
          q.option_a &&
          q.option_b &&
          q.option_c &&
          q.option_d &&
          q.correct_answer &&
          ["A", "B", "C", "D"].includes(q.correct_answer) &&
          q.explanation
      );

      if (!validQuestions?.length) {
        throw new Error("No valid questions generated");
      }

      return {
        questions: validQuestions,
        generated_count: validQuestions.length,
        requested_count: questionCount,
      };
    } catch (error) {
      console.error("MCQ generation error (Cohere):", error);
      throw new Error(`Failed to generate MCQs: ${error.message}`);
    }
  }
}

export default MCQGenerator;