import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase";

// GET /api/organizations/[id] — Get organization details with members
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

    // Verify membership
    const membershipSnap = await adminDb
      .collection("orgMembers")
      .where("organizationId", "==", id)
      .where("userId", "==", userId)
      .limit(1)
      .get();

    if (membershipSnap.empty) {
      return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 });
    }

    const orgDoc = await adminDb.collection("organizations").doc(id).get();
    if (!orgDoc.exists) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const organization = { id: orgDoc.id, ...orgDoc.data() };

    // Get members
    const membersSnap = await adminDb
      .collection("orgMembers")
      .where("organizationId", "==", id)
      .orderBy("joinedAt", "asc")
      .get();

    const enrichedMembers = membersSnap.docs.map((d) => {
      const data = d.data();
      let parsedPermissions: string[] = [];
      try { parsedPermissions = data.permissions ? JSON.parse(data.permissions) : []; } catch { parsedPermissions = []; }
      return { id: d.id, ...data, permissions: parsedPermissions };
    });

    return NextResponse.json({
      data: { ...organization, members: enrichedMembers, memberCount: enrichedMembers.length },
    });
  } catch (error) {
    console.error("[GET /api/organizations/[id]] Error:", error);
    return NextResponse.json({ error: "Failed to fetch organization" }, { status: 500 });
  }
}

// PUT /api/organizations/[id] — Update organization
export async function PUT(
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
    const body = await request.json();
    const { name, slug, description, icon } = body;

    const membershipSnap = await adminDb
      .collection("orgMembers")
      .where("organizationId", "==", id)
      .where("userId", "==", userId)
      .limit(1)
      .get();

    if (membershipSnap.empty) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const memberData = membershipSnap.docs[0].data();
    if (memberData.role !== "owner" && memberData.role !== "admin") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const orgDoc = await adminDb.collection("organizations").doc(id).get();
    if (!orgDoc.exists) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const existing = orgDoc.data();

    if (slug && slug !== existing.slug) {
      const slugConflict = await adminDb
        .collection("organizations")
        .where("slug", "==", slug)
        .limit(1)
        .get();
      if (!slugConflict.empty) {
        return NextResponse.json({ error: "An organization with this slug already exists" }, { status: 409 });
      }
    }

    const updateData: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (name) updateData.name = name;
    if (slug) updateData.slug = slug;
    if (description !== undefined) updateData.description = description;
    if (icon !== undefined) updateData.icon = icon;

    await adminDb.collection("organizations").doc(id).update(updateData);

    return NextResponse.json({ data: { id, ...existing, ...updateData } });
  } catch (error) {
    console.error("[PUT /api/organizations/[id]] Error:", error);
    return NextResponse.json({ error: "Failed to update organization" }, { status: 500 });
  }
}

// DELETE /api/organizations/[id] — Delete organization (owner only)
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

    const orgDoc = await adminDb.collection("organizations").doc(id).get();
    if (!orgDoc.exists) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Get members to check ownership
    const membersSnap = await adminDb
      .collection("orgMembers")
      .where("organizationId", "==", id)
      .get();

    const isOwner = membersSnap.docs.some(
      (d) => d.data().userId === userId && d.data().role === "owner"
    );

    if (!isOwner) {
      return NextResponse.json({ error: "Only the organization owner can delete it" }, { status: 403 });
    }

    // Delete org and all members
    await adminDb.collection("organizations").doc(id).delete();
    const batch = adminDb.batch();
    for (const memberDoc of membersSnap.docs) {
      batch.delete(memberDoc.ref);
    }
    await batch.commit();

    return NextResponse.json({ data: { id, deleted: true }, message: "Organization deleted successfully" });
  } catch (error) {
    console.error("[DELETE /api/organizations/[id]] Error:", error);
    return NextResponse.json({ error: "Failed to delete organization" }, { status: 500 });
  }
}
