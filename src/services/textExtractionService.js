import fs from "fs/promises"; // changes this
import PdfParse from "pdf-parse";
import  officeParser  from "officeparser";
import pdf2pic from "pdf2pic";
import sharp from "sharp";
import Tesseract from "tesseract.js";
import mammoth from "mammoth";
import unzipper from "unzipper";
import path from "path";
import { createReadStream } from 'fs'



// TODO: handlers for other file types -> nelson (.ppt, .pptx), ronaldo (.doc, .docx)
class TextExtractor {
    static async extractFromPDF(filePath) {
        try {
            // first try to extract text directly from PDF
            const pdfBuffer = await fs.readFile(filePath); 
            const pdfData = await PdfParse(pdfBuffer);

            if (pdfData.text && pdfData.text.trim().length > 100) {
                console.log('Text extracted directly from PDF');
                return {
                    text: pdfData.text,
                    method: 'direct',
                    pages: pdfData.numpages
                };
            }

            // if direct extraction gives no or very little text, use OCR
            console.log('Direct extraction does not work');
            return await this.extractFromPDFWithOCR(filePath);
        } catch (error) {
            console.error('PDF extraction error: ', error);
            throw new Error('Failed to extract text from PDF');
        }
    }

    static async extractFromPDFWithOCR(filePath) {
        try {
            // convert PDF pages into images
            const convert = pdf2pic.fromPath(filePath, {
                density: 300,
                saveFilename: "page",
                savePath: "./temp",
                format: "png",
                width: 2048,
                height: 2048
            });

            const results = await convert.bulk(-1);
            let fullText = '';

            for (const result of results) {
                console.log(`Processing page ${result.page}...`);
                const { data: { text } } = await Tesseract.recognize(result.path, 'eng', {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            console.log(`OCR progress: ${Math.round(m.progress * 100)}%`);
                        }
                    }
                });

                fullText += `\n--- Page ${result.page} ---\n${text}\n`;

                // clean up temporary image file
                try {
                    await fs.unlink(result.path);
                } catch (error) {
                    console.warn('Failed to delete temp file: ', result.path);
                }
            }
            return {
                text: fullText,
                method: 'ocr',
                pages: results.length
            };
        } catch (error) {
            console.error('OCR extraction error: ', error);
            throw new Error('Failed to extract text using OCR');
        }
    }

    static async extractFromImage(filePath) {
        try {
            console.log('Processing image with OCR...');

            // optimize image for OCR
            const optimizedPath = filePath.replace(/\.[^/.]+$/, '_optimized.png');
            await sharp(filePath)
            .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
            .greyscale()
            .normalize()
            .png()
            .toFile(optimizedPath);

            const { data: { text }} = await Tesseract.recognize(optimizedPath, 'eng', {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        console.log(`OCR progress: ${Math.round(m.progress * 100)}%`);
                    }
                }
            });
            // clean up optimized image
            try {
                await fs.unlink(optimizedPath);
            } catch (e) {
                console.warn('Failed to delete optimized image');
            }
            return {
                text,
                method: 'ocr',
                pages: 1
            };
        } catch (error) {
            console.error('Image OCR error: ', error);
            throw new Error('Failed to extract text from image');
        }
    }

    // text extraction function for iphones' HEIC
    // writing for heif as heif is the container format of heic
    
    static async extractFromHEIF(filePath)
    {
         try {
            console.log('Processing HEIC image with OCR...');

            // Convert HEIC to PNG using sharp (sharp supports HEIC if libvips is built with HEIC support)
            const optimizedPath = filePath.replace(/\.[^/.]+$/, '_optimized.png');
            await sharp(filePath)
                .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
                .greyscale()
                .normalize()
                .png()
                .toFile(optimizedPath);

            const { data: { text } } = await Tesseract.recognize(optimizedPath, 'eng', {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        console.log(`OCR progress: ${Math.round(m.progress * 100)}%`);
                    }
                }
            });

             // clean up optimized image
            try {
                await fs.unlink(optimizedPath);
            } catch (e) {
                console.warn('Failed to delete optimized image');
            }

            return {
                text,
                method: 'ocr-heic',
                pages: 1
            };
        } catch (error) {
            console.error('HEIC OCR error: ', error);
            throw new Error('Failed to extract text from HEIC image');
        }
    }

   static async extractFromPPT(filePath) {
  try {
    // 1. Attempt direct text extraction
    const rawText = await new Promise((resolve, reject) => {
      officeParser.parseOffice(filePath, (err, data) => {
        if (err && typeof err === 'string' && !data) return resolve(err);
        if (err) return reject(err);
        resolve(data);
      });
    });

    const textFromParser = rawText?.trim() || '';
    const slideCountEstimate = textFromParser.split(/\n\s*\n/).length;
    console.log("Parsed text from PowerPoint using officeparser");

    // 2. Safely attempt OCR fallback
    let ocrText = '';
    let ocrPages = 0;

    try {
      const ocrResult = await this.extractFromPPTWithOCR(filePath);
      ocrText = ocrResult?.text?.trim() || '';
      ocrPages = ocrResult.pages || 0;
    } catch (ocrError) {
      console.warn("OCR skipped or failed:", ocrError.message);
    }

    // 3. Combine both sources of text
    const combinedText = `
--- Extracted via Parser ---
${textFromParser}

--- Extracted via OCR ---
${ocrText}
    `.trim();

    if (!combinedText || combinedText.length < 50) {
      throw new Error("Insufficient content extracted from PowerPoint");
    }

    return {
      text: combinedText,
      method: ocrText ? 'parser + ocr' : 'parser only',
      pages: slideCountEstimate + ocrPages
    };
  } catch (error) {
    console.error("Hybrid PPT extraction error:", error);
    throw new Error("Failed to extract text from PowerPoint");
  }
}

static async extractFromPPTWithOCR(filePath) {
  const tempDir = path.join("./temp1", `pptx_extract_${Date.now()}`);
  const ocrTexts = [];

  try {
    await fs.mkdir(tempDir, { recursive: true });
    await createReadStream(filePath)
      .pipe(unzipper.Extract({ path: tempDir }))
      .promise();

    const mediaDir = path.join(tempDir, "ppt", "media");

    let mediaFiles = [];
    try {
      await fs.access(mediaDir);
      mediaFiles = await fs.readdir(mediaDir);
    } catch (err) {
      console.warn("No media folder found in PPTX. Skipping OCR.");
      return { text: '', method: 'ocr-images', pages: 0 };
    }

    const imageFiles = mediaFiles.filter(f =>
      /\.(jpg|jpeg|png|webp|bmp|gif)$/i.test(f)
    );

    if (imageFiles.length === 0) {
      console.warn("No image files found in media folder.");
      return { text: '', method: 'ocr-images', pages: 0 };
    }

    for (const file of imageFiles) {
      const imgPath = path.join(mediaDir, file);
      const { data: { text } } = await Tesseract.recognize(imgPath, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR progress on ${file}: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      ocrTexts.push(`--- OCR from ${file} ---\n${text}`);
    }

    return {
      text: ocrTexts.join('\n\n'),
      method: 'ocr-images',
      pages: ocrTexts.length || 1
    };
  } catch (error) {
    console.error("OCR fallback on PPT failed:", error);
    throw new Error("Failed to extract text via OCR from PowerPoint");
  } finally {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.warn("Failed to clean temp PPT dir:", cleanupErr);
    }
  }
}



static async extractFromDOC(filePath) {
  try {
    // Step 1: Attempt text extraction with Mammoth
    const result = await mammoth.extractRawText({ path: filePath });
    const rawText = result?.value?.trim() || '';
    console.log("Extracted text from DOCX using Mammoth");

    // Step 2: OCR fallback for embedded images
    let ocrText = '';
    let ocrPages = 0;
      try {
        const ocrResult = await this.extractFromDOCWithOCR(filePath);
        ocrText = ocrResult.text?.trim() || '';
        ocrPages = ocrResult.pages || 0;
      } catch (ocrErr) {
        console.warn("OCR on DOCX failed:", ocrErr.message);
      }
    

    const combinedText = `
--- Extracted via Parser ---
${rawText}

--- Extracted via OCR ---
${ocrText}
    `.trim();

    if (!combinedText || combinedText.length < 50) {
      throw new Error("Insufficient content extracted from Word document");
    }

    return {
      text: combinedText,
      method: ocrText ? 'parser + ocr' : 'parser only',
      pages: 1 + ocrPages
    };
  } catch (error) {
    console.error("Hybrid DOCX extraction error:", error);
    throw new Error("Failed to extract text from DOCX");
  }
}

static async extractFromDOCWithOCR(filePath) {
  const tempDir = path.join("./temp1", `docx_extract_${Date.now()}`);
  const ocrTexts = [];

  try {
    // Step 1: Unzip the DOCX file to a temporary directory
    await fs.mkdir(tempDir, { recursive: true });
    await createReadStream(filePath)
      .pipe(unzipper.Extract({ path: tempDir }))
      .promise();

    // Step 2: Identify all potential media directories (images may vary by authoring tool)
    const candidateDirs = [
      path.join(tempDir, "word", "media"),
      path.join(tempDir, "word", "embeddings")
    ];

    let mediaDir = '';
    let imageFiles = [];

    for (const dir of candidateDirs) {
      try {
        await fs.access(dir);
        const files = await fs.readdir(dir);
        const validImages = files.filter(f =>
          /\.(jpg|jpeg|png|webp|bmp|gif)$/i.test(f)
        );
        if (validImages.length > 0) {
          mediaDir = dir;
          imageFiles = validImages;
          break;
        }
      } catch {
        // Directory doesn't exist, continue checking others
      }
    }

    if (!mediaDir || imageFiles.length === 0) {
      console.warn("No valid image files found for OCR in DOCX.");
      return { text: '', method: 'ocr-images', pages: 0 };
    }

    // Step 3: OCR each image
    for (const file of imageFiles) {
      const imgPath = path.join(mediaDir, file);
      const { data: { text } } = await Tesseract.recognize(imgPath, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR progress on ${file}: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      ocrTexts.push(`--- OCR from ${file} ---\n${text}`);
    }

    return {
      text: ocrTexts.join('\n\n'),
      method: 'ocr-images',
      pages: ocrTexts.length || 1
    };
  } catch (error) {
    console.error("OCR fallback on DOCX failed:", error);
    throw new Error("Failed to extract text via OCR from DOCX");
  } finally {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.warn("Failed to clean temp DOCX dir:", cleanupErr);
    }
  }
}
}

export default TextExtractor;