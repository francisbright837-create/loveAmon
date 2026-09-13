const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Video storage (existing)
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'loveconnect/videos',
    resource_type: 'video',
    allowed_formats: ['mp4', 'mov', 'avi'],
    transformation: [{ width: 720, height: 1280, crop: 'limit' }]
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

// ✅ NEW: Profile photo storage
const imageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'loveconnect/profiles',
    resource_type: 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, height: 800, crop: 'limit' }]
  }
});

const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

module.exports = { cloudinary, upload, uploadImage };