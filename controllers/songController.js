import Song from "../models/Song.js";

/* =========================
   UPLOAD SONG
========================= */
export const uploadSong = async (req, res) => {
  try {
    const { title } = req.body;

    if (!title || !req.file) {
      return res
        .status(400)
        .json({ message: "Title and song file are required" });
    }

    const song = await Song.create({
      title,
      song: {
        data: req.file.buffer,
        contentType: req.file.mimetype
      }
    });

    res.status(201).json({
      message: "Song uploaded successfully",
      songId: song._id
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   GET ALL SONGS (LIST)
========================= */
export const getAllSongs = async (req, res) => {
  try {
    const songs = await Song.find().select("title createdAt");
    res.json(songs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   STREAM / PLAY SONG (with range support)
========================= */
export const streamSong = async (req, res) => {
  try {
    const { id } = req.params;

    const song = await Song.findById(id);
    if (!song || !song.song?.data)
      return res.status(404).json({ message: "Song not found" });

    const songBuffer = song.song.data;
    const range = req.headers.range;

    if (!range) {
      // send full file if no Range header
      res.set({
        "Content-Type": song.song.contentType,
        "Content-Length": songBuffer.length
      });
      return res.send(songBuffer);
    }

    const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB
    const start = Number(range.replace(/\D/g, ""));
    const end = Math.min(start + CHUNK_SIZE, songBuffer.length - 1);

    const chunk = songBuffer.slice(start, end + 1);
    const contentLength = end - start + 1;

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${songBuffer.length}`,
      "Accept-Ranges": "bytes",
      "Content-Length": contentLength,
      "Content-Type": song.song.contentType
    });

    res.end(chunk);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   DELETE SONG
========================= */
export const deleteSong = async (req, res) => {
  try {
    const { id } = req.params;

    const song = await Song.findByIdAndDelete(id);
    if (!song)
      return res.status(404).json({ message: "Song not found" });

    res.json({ message: "Song deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
