import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { randomBytes, createCipheriv } from "crypto";

let encryptionKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (encryptionKey) return encryptionKey;
  encryptionKey = randomBytes(32);
  return encryptionKey;
}

function encrypt(plaintext: string): {
  encryptedData: string;
  iv: string;
  authTag: string;
} {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return {
    encryptedData: encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

// GET /api/vault — List vault items (safe fields only)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const items = await db.vaultItem.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        label: true,
        domain: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ data: items });
  } catch (error) {
    console.error("[GET /api/vault] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch vault items" },
      { status: 500 }
    );
  }
}

// POST /api/vault — Store a new encrypted item
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, label, data, domain } = body;

    if (!type || typeof type !== "string" || type.trim().length === 0) {
      return NextResponse.json({ error: "Type is required" }, { status: 400 });
    }

    if (!label || typeof label !== "string" || label.trim().length === 0) {
      return NextResponse.json(
        { error: "Label is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    if (!data || typeof data !== "string" || data.length === 0) {
      return NextResponse.json(
        { error: "Data is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    const validTypes = ["api_key", "token", "credential", "certificate", "ssh_key"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const { encryptedData, iv, authTag } = encrypt(data);

    const vaultItem = await db.vaultItem.create({
      data: {
        type: type.trim(),
        label: label.trim(),
        encryptedData,
        domain: domain || null,
        iv,
        authTag,
        userId: session.user.id,
      },
      select: {
        id: true,
        type: true,
        label: true,
        domain: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      { data: vaultItem, message: "Item encrypted and stored successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/vault] Error:", error);
    return NextResponse.json(
      { error: "Failed to store vault item" },
      { status: 500 }
    );
  }
}
