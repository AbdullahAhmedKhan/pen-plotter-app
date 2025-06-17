// app/api/get-profiles/route.js
import pool from "@/app/lib/db";
// import pool from "../lib/db";

export async function GET() {
  try {
    const [rows] = await pool.execute("SELECT key_name, profile_data FROM profiles");
    return new Response(JSON.stringify({ success: true, profiles: rows }), { status: 200 });
  } catch (error) {
    console.error("Error fetching profiles:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch profiles" }), { status: 500 });
  }
}