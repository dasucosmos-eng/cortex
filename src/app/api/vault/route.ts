import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomBytes, createCipheriv } from "crypto";

// In-memory encryption key (in production, use OS keychain / KMS)
let encryptionKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (encryptionKey) return encryptionKey;
  // Generate a 256-bit (32 byte) key for AES-256
  encryptionKey = randomBytes(32);
  return encryptionKey;
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns { encryptedData, iv, authTag } all as hex strings.
 */
function encrypt(plaintext: string): {
  encryptedData: string;
  iv: string;
  authTag: string;
} {
  const key = getEncryptionKey();
  const iv = randomBytes(12); // 12 bytes IV recommended for GCM
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

// GET /api/vault — List vault items (safe fields only, never return encrypted data)
export async function GET() {
  try {
    const items = await db.vaultItem.findMany({
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
    const body = await request.json();
    const { type, label, data, domain } = body;

    if (!type || typeof type !== "string" || type.trim().length === 0) {
      return NextResponse.json(
        { error: "Type is required" },
        { status: 400 }
      );
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

    // Encrypt the data
    const { encryptedData, iv, authTag } = encrypt(data);

    const vaultItem = await db.vaultItem.create({
      data: {
        type: type.trim(),
        label: label.trim(),
        encryptedData,
        domain: domain || null,
        iv,
        authTag,
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
      {
        data: vaultItem,
        message: "Item encrypted and stored successfully",
      },
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
