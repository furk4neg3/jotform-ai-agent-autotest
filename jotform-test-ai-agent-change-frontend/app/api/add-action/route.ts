import { type NextRequest, NextResponse } from "next/server"

const FLASK_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const response = await fetch(`${FLASK_API_URL}/add_action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Flask API error: ${response.status}`)
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error adding action:", error)
    return NextResponse.json({ error: "Failed to add action" }, { status: 500 })
  }
}
