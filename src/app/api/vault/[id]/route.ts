import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase";
import { randomBytes, createDecipheriv } from "crypto";

let encryptionKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (encryptionKey) return encryptionKey;
  encryptionKey = randomBytes(32);
  return encryptionKey;
}

function decrypt(
  encryptedData: string,
  ivHex: string,
  authTagHex: string
): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// GET /api/vault/[id] — Retrieve and decrypt a vault item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.uid;
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Vault item ID is required" }, { status: 400 });
    }

    const doc = await adminDb.collection("vault").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Vault item not found" }, { status: 404 });
    }

    const vaultItem = doc.data();
    if (vaultItem.userId !== userId) {
      return NextResponse.json({ error: "Vault item not found" }, { status: 404 });
    }

    const plaintext = decrypt(
      vaultItem.encryptedData,
      vaultItem.iv,
      vaultItem.authTag
    );

    return NextResponse.json({
      data: {
        id: doc.id,
        type: vaultItem.type,
        label: vaultItem.label,
        data: plaintext,
        domain: vaultItem.domain,
        createdAt: vaultItem.createdAt,
        updatedAt: vaultItem.updatedAt,
      },
    });
  } catch (error) {
    console.error("[GET /api/vault/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve vault item. Decryption may have failed." },
      { status: 500 }
    );
  }
}

// DELETE /api/vault/[id] — Remove a vault item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.uid;
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Vault item ID is required" }, { status: 400 });
    }

    const doc = await adminDb.collection("vault").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Vault item not found" }, { status: 404 });
    }

    const vaultItem = doc.data();
    if (vaultItem.userId !== userId) {
      return NextResponse.json({ error: "Vault item not found" }, { status: 404 });
    }

    await adminDb.collection("vault").doc(id).delete();

    return NextResponse.json({ message: "Vault item deleted successfully" });
  } catch (error) {
    console.error("[DELETE /api/vault/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete vault item" },
      { status: 500 }
    );
  }
}
