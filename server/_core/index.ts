import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { storagePut } from "../storage";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.post("/api/uploads/incident-photo", async (req, res) => {
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    const { fileName, mimeType, sizeBytes, dataBase64 } = req.body ?? {};
    if (!allowedTypes.has(mimeType) || typeof fileName !== "string" || typeof dataBase64 !== "string") {
      return res.status(400).json({ error: "Only JPEG, PNG, and WebP incident photos are accepted." });
    }
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > 5 * 1024 * 1024) {
      return res.status(400).json({ error: "Incident photos must be between 1 byte and 5 MB." });
    }
    try {
      const fileBuffer = Buffer.from(dataBase64, "base64");
      if (fileBuffer.length !== Number(sizeBytes)) return res.status(400).json({ error: "Photo payload size does not match its declared size." });
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "incident-photo";
      const stored = await storagePut(`incident-photos/${Date.now()}-${safeName}`, fileBuffer, mimeType);
      return res.json({ key: stored.key, url: stored.url, stored: true });
    } catch (error) {
      console.error("[IncidentPhoto] Upload failed:", error);
      return res.status(502).json({ error: "Photo storage is unavailable. The incident was not submitted." });
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
