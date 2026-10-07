import { Check, X } from "lucide-react";
import { Card } from "@/shared/components/card";
import { Button } from "@/shared/components/button";
import type { PendingAdmin } from "@/shared/types";

interface AdminApprovalCardProps {
  admin: PendingAdmin;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
}

/**
 * M3 list item for a pending admin. Approve is a `filled` button, deny is an
 * `outlined` icon button with the error role — not an arbitrary red hover.
 */
export function AdminApprovalCard({ admin, onApprove, onDeny }: AdminApprovalCardProps) {
  return (
    <Card key={admin.id} variant="outlined" className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <h3 className="truncate text-title-medium">{admin.username}</h3>
        <p className="mt-0.5 truncate text-body-small text-on-surface-variant">{admin.email}</p>
        <p className="mt-2 text-label-medium text-on-surface-variant">
          Requested {new Date(admin.createdAt).toLocaleDateString()}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outlined"
          size="icon"
          onClick={() => onDeny(admin.id)}
          aria-label={`Deny ${admin.username}`}
          className="border-error text-error"
        >
          <X size={20} />
        </Button>
        <Button onClick={() => onApprove(admin.id)} size="sm">
          <Check size={20} /> Approve
        </Button>
      </div>
    </Card>
  );
}
