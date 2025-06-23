import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";

const storage = multer.diskStorage({ // create a storage engine that saves files to disk
    destination: (req, file, cb) => { // callback to tell multer where to store the file
        const uploadDir = "./uploads";
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => { // callback to generate a unique filename
        cb(null, `${uuidv4()}-${file.originalname}`)
    }
});

// TODO: allow .doc(old Word), .docx(new Word), .heic(iPhone photo format)
const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => { // validate the MIME type of uploaded files
        const allowedTypes = [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'image/heic', // this is for HEIC
            'image/heif', // this is for HEIF 
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/msword', // for .doc
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // for .docx

        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Unsupported file type"), false);
        }
    }
});

export default upload;