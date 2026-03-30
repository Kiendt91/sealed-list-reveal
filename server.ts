import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin (using local config if available)
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
if (fs.existsSync(configPath)) {
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = admin.firestore();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Background Cleanup Task (runs every hour)
  setInterval(async () => {
    console.log("Running cleanup task...");
    try {
      const now = new Date().toISOString();
      const expiredMatches = await db.collection('matches')
        .where('expiresAt', '<', now)
        .limit(50)
        .get();

      for (const matchDoc of expiredMatches.docs) {
        const matchId = matchDoc.id;
        console.log(`Deleting expired match: ${matchId}`);
        
        // Delete subcollections first (lists)
        const lists = await db.collection('matches').doc(matchId).collection('lists').get();
        const batch = db.batch();
        lists.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        // Delete the match doc
        await matchDoc.ref.delete();
      }
    } catch (err) {
      console.error("Cleanup error:", err);
    }
  }, 1000 * 60 * 60); // 1 hour

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
