import { type NextRequest, NextResponse } from "next/server"

const FLASK_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Forward the request to your Flask backend
    const response = await fetch(`${FLASK_API_URL}/batch_update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error("🛑 Flask rejected with:", response.status, text)
      throw new Error(`Flask API error: ${response.status}`)
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error connecting to Flask backend:", error)
    return NextResponse.json({ error: "Failed to connect to backend service" }, { status: 500 })
  }
}
