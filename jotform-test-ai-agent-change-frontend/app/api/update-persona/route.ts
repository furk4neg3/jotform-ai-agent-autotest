import { type NextRequest, NextResponse } from "next/server"

const FLASK_API_URL = process.env.FLASK_API_URL || "http://localhost:5000"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { update_type, ...data } = body

    let endpoint = "/update_persona"
    if (update_type === "name") endpoint = "/update_name"
    else if (update_type === "role") endpoint = "/update_role"
    else if (update_type === "guideline") endpoint = "/add_guideline"

    const response = await fetch(`${FLASK_API_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error(`Flask API error: ${response.status}`)
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error updating persona:", error)
    return NextResponse.json({ error: "Failed to update persona" }, { status: 500 })
  }
}
