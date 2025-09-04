require('dotenv').config();

const express = require('express');
const app = express();
const userModel = require('./models/user');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const Alumni = require("./models/alumni");
const multer = require('multer');
const nodemailer = require('nodemailer');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Folder jahan files save hongi
        cb(null, 'public/uploads/images');
    },
    filename: function (req, file, cb) {
        // Har file ko ek unique naam dega taaki files overwrite na hon
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'ankitkmr150802@gmail.com',      // <<-- APNA GMAIL ID YAHAN DAALEIN
        pass: 'ukua tpxa muce dkmh'        // <<-- AAPKA APP PASSWORD
    }
});

app.set("view engine", "ejs");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

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
            let user = await userModel.create({
                fullName,
                email,
                password: hash,
                college
            });

            console.log("User saved:", user);
            let token = jwt.sign({email: email, userid : user._id, college: user.college, fullName: user.fullName }, "secretkey");
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
            // Successful login
            let token = jwt.sign({ email: user.email, userid: user._id, college: user.college, fullName: user.fullName  }, "secretkey");
            res.cookie("token", token);
            return res.redirect("/dashboard");
        } 
        else {
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
  if (!token) {
    return res.redirect("/login");
  }

  jwt.verify(token, "secretkey", (err, decoded) => {
    if (err) {
      return res.redirect("/login");
    }
    req.user = decoded; 
    next();
  });
}

app.get("/dashboard", isLoggedIn, async (req, res) => {
    try {
        // Step 1: Sirf uss college ke alumni ka data nikalo jo admin ka hai
        const collegeName = req.user.college;
        const alumniOfCollege = await Alumni.find({ college: collegeName });

        const totalAlumni = alumniOfCollege.length;

        const companiesPlaced = alumniOfCollege.filter(alumnus => alumnus.placedOnCampus === true).length;

        
        let highestPackage = 0;
        let highestPackageString = "N/A";

        alumniOfCollege.forEach(alumnus => {
            if (alumnus.currentPackage) {
                // "₹ 52 LPA" se number "52" nikalna
                const packageNumber = parseFloat(alumnus.currentPackage.replace(/[^0-9.]/g, ''));
                if (!isNaN(packageNumber) && packageNumber > highestPackage) {
                    highestPackage = packageNumber;
                    highestPackageString = alumnus.currentPackage;
                }
            }
        });

        // Step 3: Saare stats ko ek object mein daalo
        const stats = {
            totalAlumni: totalAlumni,
            companiesPlaced: companiesPlaced,
            highestPackage: highestPackageString
        };

        
        res.render("dashboard", { 
            user: req.user,
            stats: stats  
        });

    } catch (err) {
        console.error("Dashboard data fetching error:", err);
        
        res.render("dashboard", {
            user: req.user,
            stats: { totalAlumni: 0, companiesPlaced: 0, highestPackage: 'Error' }
        });
    }
});

app.get("/alumni/add", isLoggedIn, (req, res) => {
    res.render("addAlumni", { user: req.user });
});

// 2. 'Add Alumni' form ka data handle karna
app.post("/alumni/add", isLoggedIn, upload.single('image'), async (req, res) => {
    try {
        const { email, rollno } = req.body;
        if (await Alumni.findOne({ $or: [{ email }, { rollno }] })) {
            return res.status(409).json({ success: false, message: "Alumnus with this email or roll number already exists." });
        }
        
        const alumniData = req.body;
        alumniData.college = req.user.college;
        if (req.file) {
            alumniData.image = `/uploads/images/${req.file.filename}`;
        }

        await Alumni.create(alumniData);
        return res.status(201).json({ success: true, message: "Alumni Added Successfully!" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Server error. Please try again." });
    }
});

app.get("/alumni/year/:year", isLoggedIn, async (req, res) => {
    try {
        const passoutYear = parseInt(req.params.year);
        const alumni = await Alumni.find({ 
            passoutYear: passoutYear, 
            college: req.user.college 
        });

        const totalAlumniInBatch = alumni.length;
        const totalPlacedInBatch = alumni.filter(a => a.placedOnCampus === true).length;
        
        const batchStats = {
            totalAlumniInBatch,
            totalPlacedInBatch
        };

        res.render("year", { 
            user: req.user, 
            year: passoutYear, 
            alumni: alumni,
            batchStats: batchStats 
        });

    } catch (err) {

        res.redirect('/dashboard');
    }
});

// 4. Dikhane ke liye 'Update Alumni' form
app.get("/alumni/update/:id", isLoggedIn, async (req, res) => {
    try {
        const alumnus = await Alumni.findById(req.params.id);
        if (!alumnus) return res.redirect('/dashboard');
        res.render("updateAlumni", { user: req.user, alumnus: alumnus });
    } catch (err) {
        res.redirect('/dashboard');
    }
});

// 5. 'Update Alumni' form ka data handle karna
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

app.post("/alumni/year/:year/delete", isLoggedIn, async (req, res) => {
    try {
        const passoutYear = parseInt(req.params.year);
        const collegeName = req.user.college;

        // Sirf uss admin ke college ke data ko delete karega
        const result = await Alumni.deleteMany({ 
            passoutYear: passoutYear, 
            college: collegeName 
        });

        if (result.deletedCount > 0) {
            return res.status(200).json({ 
                success: true, 
                message: `${result.deletedCount} records for the batch of ${passoutYear} have been deleted.` 
            });
        } else {
            return res.status(404).json({ 
                success: false, 
                message: "No records found for this batch to delete." 
            });
        }

    } catch (err) {
        console.error("Batch deletion error:", err);
        return res.status(500).json({ success: false, message: "Server error during batch deletion." });
    }
});

app.get("/alumni/invite", isLoggedIn, (req, res) => {
    res.render("inviteAlumni", { user: req.user });
});

// 5. Invitation bhejne ka logic
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
        const token = jwt.sign({ id: invitedAlumni._id }, "invitation_secret_key", { expiresIn: '1d' });
        const completionLink = `https://f5417ca3201e.ngrok-free.app/profile/complete/${token}`;

        await transporter.sendMail({
            from: `"Alumni Nexus (${req.user.college})" <ankitkmr1508@gmail.com>`, // <<-- APNA GMAIL ID YAHAN BHI DAALEIN
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

// 6. Alumni ke liye public form
app.get("/profile/complete/:token", async (req, res) => {
    try {
        const decoded = jwt.verify(req.params.token, "invitation_secret_key");
        const alumnus = await Alumni.findById(decoded.id);
        if (!alumnus || alumnus.status !== 'invited') {
            return res.send("<h1>Link is invalid or has already been used.</h1>");
        }
        res.render("completeProfile", { alumnus });
    } catch (err) {
        res.send("<h1>Link is invalid or has expired.</h1>");
    }
});

// 7. Alumni jab form submit karega
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
        updateData.status = 'verified'; // Profile ab verified hai

        await Alumni.findByIdAndUpdate(req.params.id, updateData);
        res.render("thankYou"); // Ek "Thank You" page render karein
    } catch (err) {
        res.send("<h1>Something went wrong. Please try again.</h1>");
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
