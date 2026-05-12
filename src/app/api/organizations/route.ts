import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/organizations — List organizations the user belongs to
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memberships = await db.orgMember.findMany({
      where: { userId: session.user.id },
      include: {
        organization: {
          include: {
            members: {
              select: { id: true, userId: true, role: true, permissions: true, joinedAt: true },
            },
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });

    const organizations = memberships.map((m) => ({
      ...m.organization,
      myRole: m.role,
      myPermissions: m.permissions,
      memberCount: m.organization.members.length,
    }));

    return NextResponse.json({ data: organizations });
  } catch (error) {
    console.error("[GET /api/organizations] Error:", error);
    return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 });
  }
}

// POST /api/organizations — Create a new organization
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const existing = await db.organization.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "An organization with this slug already exists" }, { status: 409 });
    }

    const organization = await db.organization.create({
      data: { name, slug, description: description || null, icon: icon || null },
    });

    const member = await db.orgMember.create({
      data: {
        organizationId: organization.id,
        userId: session.user.id,
        role: "owner",
        permissions: JSON.stringify([
          "memories:read_write", "agents:read_write", "members:read_write",
          "settings:read_write", "vault:read_write", "audit:read",
        ]),
      },
    });

    return NextResponse.json({ data: { ...organization, membership: member } }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/organizations] Error:", error);
    return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
  }
}
