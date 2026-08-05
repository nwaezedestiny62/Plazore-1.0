import multer from "multer";

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 12 * 1024 * 1024, // 12MB per file
  },
});

export default upload;