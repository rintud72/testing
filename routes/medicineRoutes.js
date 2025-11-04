const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const {
  addMedicine,
  getMedicines,
  getMedicineById,
  updateMedicine,
  deleteMedicine
} = require("../controllers/medicineController");

// 🖼️ Multer setup for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

// ✅ Routes
router.post("/", upload.single("image"), addMedicine);
router.get("/", getMedicines);
router.get("/:id", getMedicineById);
router.put("/:id", upload.single("image"), updateMedicine);
router.delete("/:id", deleteMedicine);

module.exports = router;
