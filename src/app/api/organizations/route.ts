import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/organizations — List organizations the user belongs to
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    let organizations;
    if (userId) {
      const memberships = await db.orgMember.findMany({
        where: { userId },
        include: {
          organization: {
            include: {
              members: {
                select: {
                  id: true,
                  userId: true,
                  role: true,
                  permissions: true,
                  joinedAt: true,
                },
              },
            },
          },
        },
        orderBy: { joinedAt: "desc" },
      });

      organizations = memberships.map((m) => ({
        ...m.organization,
        myRole: m.role,
        myPermissions: m.permissions,
        memberCount: m.organization.members.length,
      }));
    } else {
      organizations = await db.organization.findMany({
        include: {
          members: {
            select: {
              id: true,
              userId: true,
              role: true,
              permissions: true,
              joinedAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    return NextResponse.json({ data: organizations });
  } catch (error) {
    console.error("[GET /api/organizations] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 }
    );
  }
}

// POST /api/organizations — Create a new organization
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, slug, description, icon, userId } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    if (!slug || typeof slug !== "string") {
      return NextResponse.json(
        { error: "slug is required" },
        { status: 400 }
      );
    }

    // Validate slug format
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) {
      return NextResponse.json(
        {
          error:
            "Invalid slug format. Use lowercase letters, numbers, and hyphens only.",
        },
        { status: 400 }
      );
    }

    // Check for existing slug
    const existing = await db.organization.findUnique({
      where: { slug },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An organization with this slug already exists" },
        { status: 409 }
      );
    }

    const organization = await db.organization.create({
      data: {
        name,
        slug,
        description: description || null,
        icon: icon || null,
      },
    });

    // Auto-add creator as owner
    const ownerUserId = userId || "system";
    const member = await db.orgMember.create({
      data: {
        organizationId: organization.id,
        userId: ownerUserId,
        role: "owner",
        permissions: JSON.stringify([
          "memories:read_write",
          "agents:read_write",
          "members:read_write",
          "settings:read_write",
          "vault:read_write",
          "audit:read",
        ]),
      },
    });

    return NextResponse.json(
      {
        data: {
          ...organization,
          membership: member,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/organizations] Error:", error);
    return NextResponse.json(
      { error: "Failed to create organization" },
      { status: 500 }
    );
  }
}
