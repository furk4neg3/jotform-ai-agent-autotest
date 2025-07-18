import { type NextRequest, NextResponse } from "next/server"

const FLASK_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

export async function GET(request: NextRequest, { params }: { params: { agentId: string } }) {
  try {
    const { agentId } = params

    const response = await fetch(`${FLASK_API_URL}/get_materials/${agentId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Flask API error: ${response.status}`)
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching materials:", error)
    return NextResponse.json({ error: "Failed to fetch materials" }, { status: 500 })
  }
}
