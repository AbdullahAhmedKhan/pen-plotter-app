// app/api/get-fonts/route.js
import pool from "@/app/lib/db";

export async function GET() {
  try {
    const [rows] = await pool.execute("SELECT name, file_path FROM fonts");
    return new Response(JSON.stringify({ success: true, fonts: rows }), { status: 200 });
  } catch (error) {
    console.error("Error fetching fonts:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch fonts" }), { status: 500 });
  }
}