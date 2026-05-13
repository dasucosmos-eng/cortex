import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase";
import { generateId } from "@/lib/db";
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
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.uid;

    const snapshot = await adminDb
      .collection("vault")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    const items = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        type: data.type,
        label: data.label,
        domain: data.domain || null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
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
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.uid;

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

    const id = generateId();
    const now = new Date().toISOString();

    await adminDb.collection("vault").doc(id).set({
      type: type.trim(),
      label: label.trim(),
      encryptedData,
      domain: domain || null,
      iv,
      authTag,
      userId,
      createdAt: now,
      updatedAt: now,
    });

    const vaultItem = {
      id,
      type: type.trim(),
      label: label.trim(),
      domain: domain || null,
      createdAt: now,
      updatedAt: now,
    };

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
