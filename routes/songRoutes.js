import express from "express";
import {
  uploadSong,
  getAllSongs,
  streamSong,
  deleteSong
} from "../controllers/songController.js";
import upload from "../middleware/upload.js";

const router = express.Router();

router.post("/upload", upload.single("song"), uploadSong);
router.get("/", getAllSongs);
router.get("/:id/stream", streamSong);
router.delete("/:id", deleteSong);

export default router;
