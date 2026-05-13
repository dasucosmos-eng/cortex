import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase";
import { generateId } from "@/lib/db";

// GET /api/organizations/[id]/members — List organization members with roles
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
      data: enrichedMembers,
      meta: {
        total: enrichedMembers.length,
        roles: {
          owners: enrichedMembers.filter((m) => m.role === "owner").length,
          admins: enrichedMembers.filter((m) => m.role === "admin").length,
          members: enrichedMembers.filter((m) => m.role === "member").length,
          viewers: enrichedMembers.filter((m) => m.role === "viewer").length,
        },
      },
    });
  } catch (error) {
    console.error("[GET /api/organizations/[id]/members] Error:", error);
    return NextResponse.json({ error: "Failed to fetch organization members" }, { status: 500 });
  }
}

// POST /api/organizations/[id]/members — Invite member
export async function POST(
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
    const { userId: targetUserId, role, permissions } = body;

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

    if (!targetUserId || typeof targetUserId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const validRoles = ["owner", "admin", "member", "viewer"];
    const memberRole = role || "member";
    if (!validRoles.includes(memberRole)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` }, { status: 400 });
    }

    // Check if already a member
    const existingSnap = await adminDb
      .collection("orgMembers")
      .where("organizationId", "==", id)
      .where("userId", "==", targetUserId)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      return NextResponse.json({ error: "User is already a member of this organization" }, { status: 409 });
    }

    const serializedPermissions = permissions && Array.isArray(permissions)
      ? JSON.stringify(permissions)
      : JSON.stringify(["memories:read", "agents:read", "vault:read"]);

    const memberId = generateId();
    const now = new Date().toISOString();

    await adminDb.collection("orgMembers").doc(memberId).set({
      organizationId: id,
      userId: targetUserId,
      role: memberRole,
      permissions: serializedPermissions,
      joinedAt: now,
    });

    let parsedPermissions: string[] = [];
    try { parsedPermissions = JSON.parse(serializedPermissions); } catch { parsedPermissions = []; }

    return NextResponse.json({
      data: {
        id: memberId,
        organizationId: id,
        userId: targetUserId,
        role: memberRole,
        permissions: parsedPermissions,
        joinedAt: now,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/organizations/[id]/members] Error:", error);
    return NextResponse.json({ error: "Failed to invite member" }, { status: 500 });
  }
}

// PUT /api/organizations/[id]/members — Update member role
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
    const { userId: targetUserId, role, permissions } = body;

    if (!targetUserId || typeof targetUserId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const myMembershipSnap = await adminDb
      .collection("orgMembers")
      .where("organizationId", "==", id)
      .where("userId", "==", userId)
      .limit(1)
      .get();

    if (myMembershipSnap.empty) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const myRole = myMembershipSnap.docs[0].data().role;
    if (myRole !== "owner" && myRole !== "admin") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Find the target member
    const memberSnap = await adminDb
      .collection("orgMembers")
      .where("organizationId", "==", id)
      .where("userId", "==", targetUserId)
      .limit(1)
      .get();

    if (memberSnap.empty) {
      return NextResponse.json({ error: "Member not found in this organization" }, { status: 404 });
    }

    const memberDoc = memberSnap.docs[0];

    const updateData: Record<string, any> = {};
    if (role) {
      const validRoles = ["owner", "admin", "member", "viewer"];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` }, { status: 400 });
      }
      updateData.role = role;
    }

    if (permissions && Array.isArray(permissions)) {
      updateData.permissions = JSON.stringify(permissions);
    }

    updateData.updatedAt = new Date().toISOString();

    await adminDb.collection("orgMembers").doc(memberDoc.id).update(updateData);

    const updatedMember = { id: memberDoc.id, ...memberDoc.data(), ...updateData };
    let parsedPermissions: string[] = [];
    try { parsedPermissions = updatedMember.permissions ? JSON.parse(updatedMember.permissions) : []; } catch { parsedPermissions = []; }

    return NextResponse.json({ data: { ...updatedMember, permissions: parsedPermissions } });
  } catch (error) {
    console.error("[PUT /api/organizations/[id]/members] Error:", error);
    return NextResponse.json({ error: "Failed to update member role" }, { status: 500 });
  }
}

// DELETE /api/organizations/[id]/members — Remove member
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
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("userId");

    if (!targetUserId) {
      return NextResponse.json({ error: "userId query parameter is required" }, { status: 400 });
    }

    const myMembershipSnap = await adminDb
      .collection("orgMembers")
      .where("organizationId", "==", id)
      .where("userId", "==", userId)
      .limit(1)
      .get();

    if (myMembershipSnap.empty) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const myRole = myMembershipSnap.docs[0].data().role;
    if (myRole !== "owner" && myRole !== "admin" && userId !== targetUserId) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Find the target member
    const memberSnap = await adminDb
      .collection("orgMembers")
      .where("organizationId", "==", id)
      .where("userId", "==", targetUserId)
      .limit(1)
      .get();

    if (memberSnap.empty) {
      return NextResponse.json({ error: "Member not found in this organization" }, { status: 404 });
    }

    const memberData = memberSnap.docs[0].data();

    if (memberData.role === "owner") {
      // Count owners
      const ownersSnap = await adminDb
        .collection("orgMembers")
        .where("organizationId", "==", id)
        .where("role", "==", "owner")
        .get();

      if (ownersSnap.size <= 1) {
        return NextResponse.json({ error: "Cannot remove the last owner. Transfer ownership to another member first." }, { status: 400 });
      }
    }

    await adminDb.collection("orgMembers").doc(memberSnap.docs[0].id).delete();

    return NextResponse.json({ data: { userId: targetUserId, organizationId: id, removed: true }, message: "Member removed successfully" });
  } catch (error) {
    console.error("[DELETE /api/organizations/[id]/members] Error:", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
