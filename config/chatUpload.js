// Uploads for chat: photos, videos and documents go to Cloudinary.
const multer = require("multer");
const path = require("path");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { cloudinary } = require("./cloudinary");

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB (the app also checks 10 MB for photos and documents)

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/3gpp"];
const AUDIO_TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/aac", "audio/x-m4a", "audio/m4a"];
const DOC_EXTS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv"];

// "image" | "video" | "audio" | "document" | null (not allowed)
function kindOfFile(file) {
  // recordings arrive as e.g. "audio/webm;codecs=opus" - only the part before ";" matters
  const mime = (file.mimetype || "").toLowerCase().split(";")[0].trim();
  if (IMAGE_TYPES.includes(mime)) return "image";
  if (VIDEO_TYPES.includes(mime)) return "video";
  if (AUDIO_TYPES.includes(mime)) return "audio";
  const ext = path.extname(file.originalname || "").toLowerCase();
  const docMime = mime.startsWith("application/") || mime.startsWith("text/");
  if (DOC_EXTS.includes(ext) && docMime) return "document";
  return null;
}

// browsers send file names as latin1; turn them back into proper text (e.g. accents)
function fixName(name) {
  try { return Buffer.from(name || "file", "latin1").toString("utf8"); } catch (e) { return name || "file"; }
}

function safeName(name) {
  return fixName(name).replace(/[^\w.\-]+/g, "_").slice(-80) || "file";
}

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const kind = kindOfFile(file);
    const base = { folder: "loveconnect/chat" };
    if (kind === "image") return { ...base, resource_type: "image" };
    if (kind === "video" || kind === "audio") return { ...base, resource_type: "video" };   // Cloudinary stores audio as "video"
    // documents are stored as-is; the file name keeps its extension so links open correctly
    return { ...base, resource_type: "raw", public_id: Date.now() + "-" + safeName(file.originalname) };
  }
});

const uploadChatFile = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (kindOfFile(file)) return cb(null, true);
    cb(new Error("This file type is not allowed. Send a photo, video, voice message, PDF, Word, Excel, PowerPoint, text or CSV file."));
  }
});

module.exports = { uploadChatFile, kindOfFile, fixName };
