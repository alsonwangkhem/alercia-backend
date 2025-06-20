import fs from "fs";
import PdfParse from "pdf-parse";
import pdf2pic from "pdf2pic";
import sharp from "sharp";
import Tesseract from "tesseract.js";

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
            console.error('PDF extarction error: ', error);
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

}

export default TextExtractor;