import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/organizations/[id]/members — List organization members with roles
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const membership = await db.orgMember.findFirst({
      where: { organizationId: id, userId: session.user.id },
    });

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 });
    }

    const organization = await db.organization.findUnique({ where: { id } });
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const members = await db.orgMember.findMany({
      where: { organizationId: id },
      orderBy: { joinedAt: "asc" },
    });

    const enrichedMembers = members.map((m) => {
      let parsedPermissions: string[] = [];
      try { parsedPermissions = m.permissions ? JSON.parse(m.permissions) : []; } catch { parsedPermissions = []; }
      return { ...m, permissions: parsedPermissions };
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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { userId, role, permissions } = body;

    const membership = await db.orgMember.findFirst({
      where: { organizationId: id, userId: session.user.id },
    });

    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const organization = await db.organization.findUnique({ where: { id } });
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const validRoles = ["owner", "admin", "member", "viewer"];
    const memberRole = role || "member";
    if (!validRoles.includes(memberRole)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` }, { status: 400 });
    }

    const existing = await db.orgMember.findFirst({ where: { organizationId: id, userId } });
    if (existing) {
      return NextResponse.json({ error: "User is already a member of this organization" }, { status: 409 });
    }

    const serializedPermissions = permissions && Array.isArray(permissions)
      ? JSON.stringify(permissions)
      : JSON.stringify(["memories:read", "agents:read", "vault:read"]);

    const member = await db.orgMember.create({
      data: { organizationId: id, userId, role: memberRole, permissions: serializedPermissions },
    });

    let parsedPermissions: string[] = [];
    try { parsedPermissions = JSON.parse(member.permissions || "[]"); } catch { parsedPermissions = []; }

    return NextResponse.json({ data: { ...member, permissions: parsedPermissions } }, { status: 201 });
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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { userId, role, permissions } = body;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const myMembership = await db.orgMember.findFirst({
      where: { organizationId: id, userId: session.user.id },
    });

    if (!myMembership || (myMembership.role !== "owner" && myMembership.role !== "admin")) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const member = await db.orgMember.findFirst({ where: { organizationId: id, userId } });
    if (!member) {
      return NextResponse.json({ error: "Member not found in this organization" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
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

    const updatedMember = await db.orgMember.update({ where: { id: member.id }, data: updateData });

    let parsedPermissions: string[] = [];
    try { parsedPermissions = JSON.parse(updatedMember.permissions || "[]"); } catch { parsedPermissions = []; }

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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId query parameter is required" }, { status: 400 });
    }

    const myMembership = await db.orgMember.findFirst({
      where: { organizationId: id, userId: session.user.id },
    });

    if (!myMembership || (myMembership.role !== "owner" && myMembership.role !== "admin" && myMembership.userId !== userId)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const member = await db.orgMember.findFirst({ where: { organizationId: id, userId } });
    if (!member) {
      return NextResponse.json({ error: "Member not found in this organization" }, { status: 404 });
    }

    if (member.role === "owner") {
      const ownerCount = await db.orgMember.count({ where: { organizationId: id, role: "owner" } });
      if (ownerCount <= 1) {
        return NextResponse.json({ error: "Cannot remove the last owner. Transfer ownership to another member first." }, { status: 400 });
      }
    }

    await db.orgMember.delete({ where: { id: member.id } });

    return NextResponse.json({ data: { userId, organizationId: id, removed: true }, message: "Member removed successfully" });
  } catch (error) {
    console.error("[DELETE /api/organizations/[id]/members] Error:", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
