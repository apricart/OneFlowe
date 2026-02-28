import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (userRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Super Admin access required" }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get("image") as File

    if (!file) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      console.warn(`[Upload] Rejected file with type: ${file.type}`)
      return NextResponse.json({
        error: `Invalid file type: ${file.type}. Only JPG, PNG, GIF, and WEBP are allowed`
      }, { status: 400 })
    }

    // Validate file size (4MB max)
    const maxSize = 4 * 1024 * 1024 // 4MB
    if (file.size > maxSize) {
      console.warn(`[Upload] Rejected file with size: ${file.size} bytes`)
      return NextResponse.json({
        error: "please upload image under 4MB"
      }, { status: 400 })
    }

    // Convert file to Base64 data URL
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Image = buffer.toString('base64')
    const dataUrl = `data:${file.type};base64,${base64Image}`

    console.log(`[Upload] Converted image to Base64 (${file.size} bytes)`)

    return NextResponse.json({
      url: dataUrl,
      fileName: file.name,
      size: file.size,
      type: file.type
    })

  } catch (error: any) {
    console.error("Critical Upload Error:", error)
    return NextResponse.json({
      error: "Internal Server Error",
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}
