import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import multer from "multer";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Create uploads directory if it doesn't exist
const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded static files
app.use("/uploads", express.static(UPLOADS_DIR));

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024 // 10GB limit for full movies
  }
});

const DATA_FILE = path.resolve(process.cwd(), "movies.json");
const REQUESTS_FILE = path.resolve(process.cwd(), "requests.json");

// Initialize data file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}
if (!fs.existsSync(REQUESTS_FILE)) {
  fs.writeFileSync(REQUESTS_FILE, JSON.stringify([]));
}

const getMovies = () => {
  try {
    const data = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

const saveMovies = (movies: any[]) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(movies, null, 2));
};

const getRequests = () => {
  try {
    const data = fs.readFileSync(REQUESTS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

const saveRequests = (requests: any[]) => {
  fs.writeFileSync(REQUESTS_FILE, JSON.stringify(requests, null, 2));
};

// Check admin passcode
const PASSCODE_FILE = path.resolve(process.cwd(), "passcode.json");
if (!fs.existsSync(PASSCODE_FILE)) {
  fs.writeFileSync(PASSCODE_FILE, JSON.stringify({ passcode: "anik@938208" }));
}

const getAdminPasscode = () => {
  try {
    const data = fs.readFileSync(PASSCODE_FILE, "utf-8");
    return JSON.parse(data).passcode;
  } catch (error) {
    return "anik@938208";
  }
};

const saveAdminPasscode = (passcode: string) => {
  fs.writeFileSync(PASSCODE_FILE, JSON.stringify({ passcode }, null, 2));
};

const isPasscodeValid = (passcode: any) => {
  if (!passcode) return false;
  return passcode === getAdminPasscode();
};

const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const passcode = req.headers["x-admin-passcode"];
  if (isPasscodeValid(passcode)) {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized. Invalid passcode." });
  }
};

// API Routes
app.post("/api/admin/verify", (req, res) => {
  const { passcode } = req.body;
  if (isPasscodeValid(passcode)) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: "Invalid passcode" });
  }
});

app.post("/api/admin/change-passcode", (req, res) => {
  const { masterPassword, newPasscode } = req.body;
  if (masterPassword === "anik@86pramanik17") {
    if (!newPasscode || typeof newPasscode !== "string" || newPasscode.trim() === "") {
      return res.status(400).json({ error: "New passcode cannot be empty." });
    }
    saveAdminPasscode(newPasscode.trim());
    res.json({ success: true });
  } else {
    res.status(401).json({ error: "Incorrect master password." });
  }
});

app.get("/api/movies", (req, res) => {
  res.json(getMovies());
});

app.post("/api/upload-video", authenticate, upload.single("video"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No video file was uploaded." });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ fileUrl });
});

app.get("/api/download/:id", (req, res) => {
  const { id } = req.params;
  const movies = getMovies();
  const movie = movies.find((m: any) => String(m.id) === String(id));
  
  if (!movie) {
    return res.status(404).send("Movie not found");
  }

  const isLocalFile = movie.downloadUrl.startsWith("/uploads/") || movie.isLocalVideo;
  if (isLocalFile) {
    const fileName = movie.downloadUrl.replace("/uploads/", "");
    const filePath = path.join(UPLOADS_DIR, fileName);
    
    if (fs.existsSync(filePath)) {
      const originalTitle = movie.title.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");
      const ext = path.extname(fileName) || ".mp4";
      res.setHeader("Content-Disposition", `attachment; filename="${originalTitle}${ext}"`);
      return res.sendFile(filePath);
    } else {
      return res.status(404).send("Error: The local video file is missing on the server. Please contact the admin.");
    }
  }

  res.redirect(movie.downloadUrl);
});

app.post("/api/movies", authenticate, (req, res) => {
  const { title, description, imageUrl, downloadUrl, isLocalVideo } = req.body;
  
  if (!title || !downloadUrl) {
    return res.status(400).json({ error: "Title and download link are required." });
  }

  const movies = getMovies();
  const newMovie = {
    id: Date.now().toString(),
    title,
    description,
    imageUrl,
    downloadUrl,
    isLocalVideo: !!isLocalVideo,
    createdAt: new Date().toISOString()
  };
  
  movies.push(newMovie);
  saveMovies(movies);
  
  res.status(201).json(newMovie);
});

app.delete("/api/movies/:id", authenticate, (req, res) => {
  const { id } = req.params;
  console.log("Delete request received for id:", id);
  const movies = getMovies();
  const movieToDelete = movies.find((m: any) => String(m.id) === String(id));
  
  if (!movieToDelete) {
    console.log("Movie not found for id:", id);
    return res.status(404).json({ error: "Movie not found" });
  }

  // Delete physical video file if local
  if (movieToDelete.isLocalVideo && movieToDelete.downloadUrl) {
    const fileName = movieToDelete.downloadUrl.replace("/uploads/", "");
    const filePath = path.join(UPLOADS_DIR, fileName);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log("Deleted local video file:", filePath);
      }
    } catch (err) {
      console.error("Failed to delete local video file:", filePath, err);
    }
  }
  
  const filteredMovies = movies.filter((m: any) => String(m.id) !== String(id));
  saveMovies(filteredMovies);
  console.log("Movie deleted successfully:", id);
  res.json({ success: true });
});

app.get("/api/requests", (req, res) => {
  res.json(getRequests());
});

app.post("/api/requests", (req, res) => {
  const { title } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: "Movie title is required." });
  }

  const requests = getRequests();
  const newRequest = {
    id: Date.now().toString(),
    title,
    createdAt: new Date().toISOString()
  };
  
  requests.push(newRequest);
  saveRequests(requests);
  
  res.status(201).json(newRequest);
});

app.delete("/api/requests/:id", authenticate, (req, res) => {
  const { id } = req.params;
  const requests = getRequests();
  const filteredRequests = requests.filter((r: any) => String(r.id) !== String(id));
  
  if (requests.length === filteredRequests.length) {
    return res.status(404).json({ error: "Request not found" });
  }
  
  saveRequests(filteredRequests);
  res.json({ success: true });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
