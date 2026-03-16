import mongoose from "mongoose";

const songSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },

    song: {
      data: Buffer,        // actual audio file (mp3/wav)
      contentType: String // audio/mpeg, audio/wav
    }
  },
  { timestamps: true }
);

export default mongoose.model("Song", songSchema);
