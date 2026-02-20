import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

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
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Only JPG, PNG, GIF, and WebP are allowed" }, { status: 400 })
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File too large. Maximum size is 5MB" }, { status: 400 })
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), "public", "uploads", "products")
    try {
      if (!existsSync(uploadsDir)) {
        console.log(`[Upload] Creating directory: ${uploadsDir}`)
        await mkdir(uploadsDir, { recursive: true })
      }
    } catch (dirErr: any) {
      console.error("[Upload] Directory creation failed:", dirErr)
      return NextResponse.json({ error: `Directory creation failed: ${dirErr.message}` }, { status: 500 })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const fileExtension = file.name.split('.').pop() || 'jpg'
    const fileName = `product_${timestamp}_${randomString}.${fileExtension}`

    // Save file
    const filePath = join(uploadsDir, fileName)
    try {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      await writeFile(filePath, buffer)
      console.log(`[Upload] Successfully saved: ${filePath}`)
    } catch (writeErr: any) {
      console.error("[Upload] File write failed:", writeErr)
      return NextResponse.json({ error: `File write failed: ${writeErr.message}` }, { status: 500 })
    }

    // Return the public URL
    const publicUrl = `/uploads/products/${fileName}`

    return NextResponse.json({
      url: publicUrl,
      fileName,
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
