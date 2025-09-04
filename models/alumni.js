const mongoose = require('mongoose');

const alumniSchema = new mongoose.Schema({
  image: { type: String, default: '/uploads/images/default-avatar.png' },
  fullName: { type: String, required: true },
  passoutYear: { type: Number, required: true },
  course: { type: String }, // Yahan se 'required: true' hata diya
  email: { type: String, required: true, unique: true },
  phone: { type: String }, 
  rollno: { type: String, required: true, unique: true },
  college: { type: String, required: true },
  placedOnCampus: { type: Boolean }, 
  initialCompany: { type: String },
  initialPackage: { type: String },
  currentCompany: { type: String }, 
  currentPackage: { type: String },
  linkedinUrl: { type: String },
  status: {
    type: String,
    enum: ['verified', 'invited', 'incomplete'],
    default: 'incomplete'
  }
});

module.exports = mongoose.model('Alumni', alumniSchema);