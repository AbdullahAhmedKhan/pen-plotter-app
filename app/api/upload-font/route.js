// app/api/upload-font/route.js
import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import pool from "@/app/lib/db";

export async function POST(request) {
  const formData = await request.formData();
  const fontFile = formData.get("font");

  if (!fontFile || !fontFile.name.endsWith(".ttf")) {
    return NextResponse.json({ error: "Please upload a valid .ttf file" }, { status: 400 });
  }

  const fontName = fontFile.name.replace(/\.ttf$/, ""); // Extract name without .ttf
  const filePath = path.join(process.cwd(), "public/fonts", fontFile.name); // Keep original name

  try {
    const arrayBuffer = await fontFile.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));

    await pool.execute(
      "INSERT INTO fonts (name, file_path) VALUES (?, ?)",
      [fontName, `/fonts/${fontFile.name}`] // Store full path
    );

    return NextResponse.json({ success: true, fontName }, { status: 201 });
  } catch (error) {
    console.error("Error uploading font:", error);
    return NextResponse.json({ error: "Failed to upload font" }, { status: 500 });
  }
}