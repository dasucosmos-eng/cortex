import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";

// GET /api/import/connectors — List available import connectors
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connectors = [
      {
        id: "github",
        name: "GitHub",
        capabilities: ["repos", "issues", "pull_requests", "code"],
        icon: "GitBranch",
      },
      {
        id: "notion",
        name: "Notion",
        capabilities: ["pages", "databases", "notes"],
        icon: "BookOpen",
      },
      {
        id: "slack",
        name: "Slack",
        capabilities: ["messages", "channels", "threads"],
        icon: "MessageSquare",
      },
      {
        id: "linear",
        name: "Linear",
        capabilities: ["issues", "projects", "cycles"],
        icon: "Target",
      },
      {
        id: "google_docs",
        name: "Google Docs",
        capabilities: ["documents", "sheets", "slides"],
        icon: "FileText",
      },
      {
        id: "vscode",
        name: "VS Code",
        capabilities: ["files", "extensions", "settings"],
        icon: "Terminal",
      },
      {
        id: "discord",
        name: "Discord",
        capabilities: ["messages", "channels", "servers"],
        icon: "MessagesSquare",
      },
      {
        id: "jira",
        name: "Jira",
        capabilities: ["issues", "epics", "sprints"],
        icon: "LayoutDashboard",
      },
      {
        id: "figma",
        name: "Figma",
        capabilities: ["files", "components", "designs"],
        icon: "Palette",
      },
    ];

    return NextResponse.json({ data: connectors });
  } catch (error) {
    console.error("[GET /api/import/connectors] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch connectors" },
      { status: 500 }
    );
  }
}
