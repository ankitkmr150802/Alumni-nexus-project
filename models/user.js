const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    college: { 
        type: String, 
        required: true, 
        enum: ["niet", "glbit", "ggc", "llc"] // dropdown values
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('user', userSchema);
