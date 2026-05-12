import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/organizations/[id] — Get organization details with members
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const organization = await db.organization.findUnique({
      where: { id },
      include: {
        members: {
          select: {
            id: true,
            userId: true,
            role: true,
            permissions: true,
            joinedAt: true,
          },
          orderBy: { joinedAt: "asc" },
        },
        workspaces: {
          select: {
            id: true,
            name: true,
            description: true,
            isDefault: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const enrichedMembers = organization.members.map((m) => {
      let parsedPermissions: string[] = [];
      try {
        parsedPermissions = m.permissions ? JSON.parse(m.permissions) : [];
      } catch {
        parsedPermissions = [];
      }
      return { ...m, permissions: parsedPermissions };
    });

    return NextResponse.json({
      data: {
        ...organization,
        members: enrichedMembers,
        memberCount: enrichedMembers.length,
      },
    });
  } catch (error) {
    console.error("[GET /api/organizations/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch organization" },
      { status: 500 }
    );
  }
}

// PUT /api/organizations/[id] — Update organization
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, slug, description, icon } = body;

    const existing = await db.organization.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // If slug is being updated, check for uniqueness
    if (slug && slug !== existing.slug) {
      const slugConflict = await db.organization.findUnique({
        where: { slug },
      });
      if (slugConflict) {
        return NextResponse.json(
          { error: "An organization with this slug already exists" },
          { status: 409 }
        );
      }
    }

    const updated = await db.organization.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(slug ? { slug } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(icon !== undefined ? { icon } : {}),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("[PUT /api/organizations/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to update organization" },
      { status: 500 }
    );
  }
}

// DELETE /api/organizations/[id] — Delete organization (owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    const organization = await db.organization.findUnique({
      where: { id },
      include: {
        members: {
          select: { id: true, userId: true, role: true },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Check if user is owner
    if (userId) {
      const isOwner = organization.members.some(
        (m) => m.userId === userId && m.role === "owner"
      );
      if (!isOwner) {
        return NextResponse.json(
          { error: "Only the organization owner can delete it" },
          { status: 403 }
        );
      }
    }

    await db.organization.delete({
      where: { id },
    });

    return NextResponse.json({
      data: { id, deleted: true },
      message: "Organization deleted successfully",
    });
  } catch (error) {
    console.error("[DELETE /api/organizations/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete organization" },
      { status: 500 }
    );
  }
}
