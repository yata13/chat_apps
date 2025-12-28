import express from "express";
import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "./authroutes.js";
import path from "path";

const router = express.Router();

// Initialize Supabase Client
// Ensure these env vars are set in Render/Production
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Must be SERVICE_ROLE key for signing URLs

const supabase = createClient(supabaseUrl, supabaseKey);

router.post("/upload-url", async (req, res) => {
    try {
        const { filename, filetype } = req.body;
        if (!filename || !filetype) {
            return res.status(400).json({ ok: false, error: "Missing filename or filetype" });
        }

        // Clean filename and make unique
        const ext = path.extname(filename);
        const name = path.basename(filename, ext).replace(/[^a-zA-Z0-9]/g, "_");
        const filePath = `avatars/${Date.now()}_${name}${ext}`;

        // Create a Signed Upload URL (valid for 60 seconds)
        const { data, error } = await supabase
            .storage
            .from('avatars')
            .createSignedUploadUrl(filePath);

        if (error) throw error;

        // The public URL where the file will be accessible after upload
        const { data: publicData } = supabase
            .storage
            .from('avatars')
            .getPublicUrl(filePath);

        res.json({
            ok: true,
            signedUrl: data.signedUrl,
            publicUrl: publicData.publicUrl,
            path: filePath
        });

    } catch (error) {
        console.error("Upload URL Error:", error);
        res.status(500).json({ ok: false, error: "Failed to generate upload URL" });
    }
});

export default router;
