const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const adminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'admin' },
  createdAt: { type: Date, default: Date.now }
});

const Admin = mongoose.model('Admin', adminSchema);

async function createAdmin() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const email = 'admin@loveamon.com';
  const password = 'AdminPass123!';
  
  const hashedPassword = await bcrypt.hash(password, 12);
  
  const admin = new Admin({
    email,
    password: hashedPassword,
    role: 'admin'
  });
  
  await admin.save();
  console.log('✅ Admin created:', email);
  console.log('Password:', password);
  process.exit(0);
}

createAdmin().catch(err => {
  console.error(err);
  process.exit(1);
});
