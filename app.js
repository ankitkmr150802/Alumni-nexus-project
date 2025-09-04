require('dotenv').config(); // Sabse upar, taaki environment variables load ho jaayein
const express = require('express');
const app = express();
const mongoose = require('mongoose'); // Mongoose ko yahan require karein
const userModel = require('./models/user');
const Alumni = require("./models/alumni");
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');

// --- DATABASE CONNECTION (YAHAN PAR CHANGE HUA HAI) ---
// Yeh aapke .env file se URL uthayega
mongoose.connect(process.env.DATABASE_URL)
    .then(() => {
        console.log("Online DB Connected Successfully!");
    })
    .catch((err) => {
        console.error("DB Connection Error:", err);
    });

// --- BAAKI SETUP WAISA HI HAI ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads/images'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // .env se aayega
        pass: process.env.EMAIL_PASS   // .env se aayega
    }
});

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

// --- User Authentication Routes ---
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/login', (req, res) => {
    res.render('index');
});

app.post('/register', async (req, res) => {
    let { fullName, email, password, college } = req.body;
    if (!fullName || !email || !password || !college) {
        return res.status(400).send("⚠️ Please fill all fields");
    }
    let user = await userModel.findOne({email});
    if(user) return res.status(400).json({ success: false, message: "User already exists" });
    let collegeAdmin = await userModel.findOne({ college });
    if (collegeAdmin) {
        return res.status(400).json({ success: false, message: "⚠️ An admin is already registered for this college" });
    }
    bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(password, salt, async (err, hash) => {
            let user = await userModel.create({ fullName, email, password: hash, college });
            let token = jwt.sign({email: email, userid : user._id, college: user.college, fullName: user.fullName }, process.env.JWT_SECRET);
            res.cookie('token', token);
            return res.status(201).json({ success: true, message: 'Registration successful', email: user.email });
        });
    });
});

app.post('/login', async (req, res) => {
    let {email, password} = req.body;
    if (!email || !password ) {
        return res.status(400).json({ success: false, message: "⚠️ Please fill all fields"});
    }
    let user = await userModel.findOne({email});
    if(!user) return res.status(400).json({ success: false, message: "User does not exists" });

    bcrypt.compare(password, user.password, function (err, result){
        if(result) {
            let token = jwt.sign({ email: user.email, userid: user._id, college: user.college, fullName: user.fullName  }, process.env.JWT_SECRET);
            res.cookie("token", token);
            return res.redirect("/dashboard");
        } else {
            return res.status(400).json({ success: false, message: "Invalid credentials" });
        }
    });
});

app.get("/logout", (req, res) => {
    res.clearCookie("token");
    res.redirect("/");
});

function isLoggedIn(req, res, next) {
    const token = req.cookies.token;
    if (!token) return res.redirect("/login");
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.redirect("/login");
        req.user = decoded;
        next();
    });
}

// --- Dashboard Route ---
app.get("/dashboard", isLoggedIn, async (req, res) => {
    try {
        const collegeName = req.user.college;
        const alumniOfCollege = await Alumni.find({ college: collegeName });
        const totalAlumni = alumniOfCollege.length;
        const totalPlaced = alumniOfCollege.filter(a => a.placedOnCampus === true).length;
        let highestPackage = 0;
        let highestPackageString = "N/A";
        alumniOfCollege.forEach(alumnus => {
            if (alumnus.currentPackage) {
                const pNum = parseFloat(alumnus.currentPackage.replace(/[^0-9.]/g, ''));
                if (!isNaN(pNum) && pNum > highestPackage) {
                    highestPackage = pNum;
                    highestPackageString = alumnus.currentPackage;
                }
            }
        });
        const stats = { totalAlumni, totalPlaced, highestPackage: highestPackageString };
        res.render("dashboard", { user: req.user, stats });
    } catch (err) {
        res.render("dashboard", { user: req.user, stats: { totalAlumni: 0, totalPlaced: 0, highestPackage: 'Error' } });
    }
});

// --- ALUMNI MANAGEMENT ROUTES ---

// Manual Add Form
app.get("/alumni/add", isLoggedIn, (req, res) => res.render("addAlumni", { user: req.user }));

// Manual Add Logic
app.post("/alumni/add", isLoggedIn, upload.single('image'), async (req, res) => {
    try {
        const { fullName, email, phone, rollno, course, passoutYear, placedOnCampus, currentCompany } = req.body;
        if (!fullName || !email || !phone || !rollno || !course || !passoutYear || !placedOnCampus || !currentCompany) {
            return res.status(400).json({ success: false, message: "Please fill all required fields for manual entry." });
        }
        if (await Alumni.findOne({ $or: [{ email }, { rollno }] })) {
            return res.status(409).json({ success: false, message: "Alumnus with this email or roll number already exists." });
        }
        const alumniData = req.body;
        alumniData.college = req.user.college;
        if (req.file) {
            alumniData.image = `/uploads/images/${req.file.filename}`;
        }
        alumniData.status = 'verified';
        await Alumni.create(alumniData);
        return res.status(201).json({ success: true, message: "Alumni Added Successfully!" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Server error. Please try again." });
    }
});

// View by Year
app.get("/alumni/year/:year", isLoggedIn, async (req, res) => {
    try {
        const passoutYear = parseInt(req.params.year);
        const alumni = await Alumni.find({ passoutYear: passoutYear, college: req.user.college });
        const batchStats = {
            totalAlumniInBatch: alumni.length,
            totalPlacedInBatch: alumni.filter(a => a.placedOnCampus === true).length
        };
        res.render("year", { user: req.user, year: passoutYear, alumni: alumni, batchStats: batchStats });
    } catch (err) {
        res.redirect('/dashboard');
    }
});

// Update Form
app.get("/alumni/update/:id", isLoggedIn, async (req, res) => {
    try {
        const alumnus = await Alumni.findById(req.params.id);
        if (!alumnus) return res.redirect('/dashboard');
        res.render("updateAlumni", { user: req.user, alumnus: alumnus });
    } catch (err) {
        res.redirect('/dashboard');
    }
});

// Update Logic
app.post("/alumni/update/:id", isLoggedIn, upload.single('image'), async (req, res) => {
    try {
        const updateData = req.body;
        if (req.file) {
            updateData.image = `/uploads/images/${req.file.filename}`;
        }
        await Alumni.findByIdAndUpdate(req.params.id, updateData);
        return res.status(200).json({ success: true, message: "Alumni Record Updated Successfully!" });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Server error during update." });
    }
});

// Delete Batch
app.post("/alumni/year/:year/delete", isLoggedIn, async (req, res) => {
    try {
        const passoutYear = parseInt(req.params.year);
        const result = await Alumni.deleteMany({ passoutYear: passoutYear, college: req.user.college });
        if (result.deletedCount > 0) {
            return res.status(200).json({ success: true, message: `${result.deletedCount} records for batch ${passoutYear} deleted.` });
        } else {
            return res.status(404).json({ success: false, message: "No records found for this batch to delete." });
        }
    } catch (err) {
        return res.status(500).json({ success: false, message: "Server error during batch deletion." });
    }
});

// --- INVITATION SYSTEM ROUTES ---

// Invite Form
app.get("/alumni/invite", isLoggedIn, (req, res) => {
    res.render("inviteAlumni", { user: req.user });
});

// Invite Logic
app.post("/alumni/invite", isLoggedIn, async (req, res) => {
    try {
        const { fullName, email, rollno, passoutYear } = req.body;
        if (!fullName || !email || !rollno || !passoutYear) {
            return res.status(400).json({ success: false, message: "Please fill all fields." });
        }
        if (await Alumni.findOne({ $or: [{ email }, { rollno }] })) {
            return res.status(409).json({ success: false, message: "Alumnus with this email or roll number already exists." });
        }
        const invitedAlumni = await Alumni.create({
            fullName, email, rollno, passoutYear,
            college: req.user.college,
            status: 'invited'
        });
        const token = jwt.sign({ id: invitedAlumni._id }, process.env.INVITE_SECRET, { expiresIn: '1d' });
        const completionLink = `${process.env.PUBLIC_URL}/profile/complete/${token}`;

        await transporter.sendMail({
            from: `"Alumni Nexus (${req.user.college})" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `🎓 Invitation to join the ${req.user.college} Alumni Network`,
            html: `<h3>Hello ${fullName},</h3><p>You have been invited to join your college's official alumni network. Please click the secure link below to complete your profile.</p><a href="${completionLink}" style="padding: 12px 22px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Complete Your Profile</a><p>This link is valid for 24 hours.</p>`
        });
        return res.status(200).json({ success: true, message: `Invitation sent to ${email} successfully.` });
    } catch (err) {
        console.error("Invite Error:", err);
        return res.status(500).json({ success: false, message: "Server error. Could not send invitation." });
    }
});

// Public Form for Alumni
app.get("/profile/complete/:token", async (req, res) => {
    try {
        const decoded = jwt.verify(req.params.token, process.env.INVITE_SECRET);
        const alumnus = await Alumni.findById(decoded.id);
        if (!alumnus || alumnus.status !== 'invited') {
            return res.send("<h1>Link is invalid or has already been used.</h1>");
        }
        res.render("completeProfile", { alumnus });
    } catch (err) {
        res.send("<h1>Link is invalid or has expired.</h1>");
    }
});

// Public Form Submission
app.post("/profile/complete/:id", upload.single('image'), async (req, res) => {
    try {
        const alumnus = await Alumni.findById(req.params.id);
        if (!alumnus || alumnus.status !== 'invited') {
            return res.status(403).send("<h1>This action is not permitted.</h1>");
        }
        const updateData = req.body;
        if (req.file) {
            updateData.image = `/uploads/images/${req.file.filename}`;
        }
        updateData.status = 'verified';
        await Alumni.findByIdAndUpdate(req.params.id, updateData, { runValidators: true });
        res.render("thankYou");
    } catch (err) {
        console.error("Profile Completion Error:", err);
        res.send("<h1>Something went wrong. Please try again.</h1>");
    }
});

app.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on port ${process.env.PORT || 3000}`);
});

