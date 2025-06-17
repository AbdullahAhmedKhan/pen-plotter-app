// export async function POST(request) {
//   const body = await request.json();
//   // Save to database or file system (e.g., using a library like prisma or fs)
//   return new Response(JSON.stringify({ success: true }), { status: 200 });
// }


// app/api/save-profile/route.js
import pool from "@/app/lib/db";

export async function POST(request) {
  try {
    const { key, profile } = await request.json();
    if (!key || !profile) {
      return new Response(JSON.stringify({ error: "Key and profile are required" }), { status: 400 });
    }

    const [result] = await pool.execute(
      "INSERT INTO profiles (key_name, profile_data) VALUES (?, ?)",
      [key, JSON.stringify(profile)]
    );

    return new Response(JSON.stringify({ success: true, id: result.insertId }), { status: 201 });
  } catch (error) {
    console.error("Error saving profile:", error);
    return new Response(JSON.stringify({ error: "Failed to save profile" }), { status: 500 });
  }
}