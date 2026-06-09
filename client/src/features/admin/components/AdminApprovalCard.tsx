import { LogOut } from 'lucide-react';
import { Card } from '@/shared/components/card';
import { Button } from '@/shared/components/button';
import type { PendingAdmin } from '@/shared/types';

interface AdminApprovalCardProps {
  admin: PendingAdmin;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
}

export function AdminApprovalCard({ admin, onApprove, onDeny }: AdminApprovalCardProps) {
  return (
    <Card key={admin.id} variant="premium-sm" className="flex items-center justify-between">
      <div>
        <h3 className="text-2xl font-poppins font-bold tracking-tight">{admin.username}</h3>
        <p className="text-xs text-black/30 font-mono font-bold mt-1 uppercase">{admin.email}</p>
        <p className="text-xs font-bold text-orange-500/40 uppercase tracking-[0.2em] mt-4">
          REQUESTED: {new Date(admin.createdAt).toLocaleDateString()}
        </p>
      </div>
      <div className="flex gap-4">
        <button 
          onClick={() => onDeny(admin.id)}
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-red-500 hover:bg-red-50 transition-all active:scale-90"
        >
          <LogOut size={20} className="rotate-180" />
        </button>
        <Button 
          onClick={() => onApprove(admin.id)}
          variant="premium"
          className="px-8 h-14 rounded-2xl"
        >
          Approve
        </Button>
      </div>
    </Card>
  );
}
