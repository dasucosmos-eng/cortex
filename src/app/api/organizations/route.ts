import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase";
import { generateId } from "@/lib/db";

// GET /api/organizations — List organizations the user belongs to
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.uid;

    // Get user's org memberships
    const membershipsSnap = await adminDb
      .collection("orgMembers")
      .where("userId", "==", userId)
      .orderBy("joinedAt", "desc")
      .get();

    const organizations: Array<Record<string, any>> = [];

    for (const memberDoc of membershipsSnap.docs) {
      const membership = memberDoc.data();
      const orgDoc = await adminDb.collection("organizations").doc(membership.organizationId).get();

      if (!orgDoc.exists) continue;

      const orgData = orgDoc.data();

      // Get all members of this org
      const orgMembersSnap = await adminDb
        .collection("orgMembers")
        .where("organizationId", "==", orgDoc.id)
        .get();

      organizations.push({
        id: orgDoc.id,
        ...orgData,
        myRole: membership.role,
        myPermissions: membership.permissions,
        memberCount: orgMembersSnap.size,
        members: orgMembersSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })),
      });
    }

    return NextResponse.json({ data: organizations });
  } catch (error) {
    console.error("[GET /api/organizations] Error:", error);
    return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 });
  }
}

// POST /api/organizations — Create a new organization
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.uid;

    const body = await request.json();
    const { name, slug, description, icon } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    if (!slug || typeof slug !== "string") {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }

    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) {
      return NextResponse.json(
        { error: "Invalid slug format. Use lowercase letters, numbers, and hyphens only." },
        { status: 400 }
      );
    }

    // Check if slug already exists
    const existingSnap = await adminDb
      .collection("organizations")
      .where("slug", "==", slug)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      return NextResponse.json({ error: "An organization with this slug already exists" }, { status: 409 });
    }

    const orgId = generateId();
    const now = new Date().toISOString();

    await adminDb.collection("organizations").doc(orgId).set({
      name,
      slug,
      description: description || null,
      icon: icon || null,
      createdAt: now,
      updatedAt: now,
    });

    const memberId = generateId();
    const serializedPermissions = JSON.stringify([
      "memories:read_write", "agents:read_write", "members:read_write",
      "settings:read_write", "vault:read_write", "audit:read",
    ]);

    await adminDb.collection("orgMembers").doc(memberId).set({
      organizationId: orgId,
      userId,
      role: "owner",
      permissions: serializedPermissions,
      joinedAt: now,
    });

    return NextResponse.json({
      data: {
        id: orgId,
        name,
        slug,
        description: description || null,
        icon: icon || null,
        createdAt: now,
        updatedAt: now,
        membership: {
          id: memberId,
          organizationId: orgId,
          userId,
          role: "owner",
          permissions: serializedPermissions,
          joinedAt: now,
        },
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/organizations] Error:", error);
    return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
  }
}
