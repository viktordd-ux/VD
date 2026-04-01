import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getAccessibleOrganizationIds } from "@/lib/org-scope";
import { writeAudit } from "@/lib/audit";
import { hardDeleteLead, hardDeleteOrder, softDeleteLead, softDeleteOrder } from "@/lib/deletion-ops";
import { revalidateAdminBulk } from "@/lib/revalidate-app";

type Body = {
  type: "orders" | "leads" | "finance";
  ids: string[];
  hard?: boolean;
};

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ids = Array.isArray(body.ids) ? [...new Set(body.ids.filter(Boolean))] : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "ids обязателен" }, { status: 400 });
  }
  if (!["orders", "leads", "finance"].includes(body.type)) {
    return NextResponse.json({ error: "Недопустимый type" }, { status: 400 });
  }

  const hard = Boolean(body.hard);
  const ok: string[] = [];
  const failed: { id: string; error: string }[] = [];
  const orgIds = await getAccessibleOrganizationIds(admin.id);

  for (const id of ids) {
    try {
      if (body.type === "leads") {
        if (hard) await hardDeleteLead(id, admin.id);
        else await softDeleteLead(id, admin.id);
      } else {
        // orders и finance — финансы привязаны к заказу
        if (hard) await hardDeleteOrder(id, admin.id, { allowedOrganizationIds: orgIds });
        else await softDeleteOrder(id, admin.id, { allowedOrganizationIds: orgIds });
      }
      ok.push(id);
    } catch (e) {
      const code = (e as { code?: string }).code;
      const msg =
        code === "NOT_FOUND"
          ? "not_found"
          : code === "LEAD_HAS_ORDERS"
            ? "lead_has_orders"
            : e instanceof Error
              ? e.message
              : "unknown";
      failed.push({ id, error: msg });
    }
  }

  await writeAudit({
    entityType: "bulk",
    entityId: `bulk-${Date.now()}`,
    actionType: "bulk_delete",
    changedById: admin.id,
    diff: {
      type: body.type,
      hard,
      ok,
      failed,
      ids,
    },
  });

  revalidateAdminBulk();
  return NextResponse.json({ ok, failed, hard });
}
