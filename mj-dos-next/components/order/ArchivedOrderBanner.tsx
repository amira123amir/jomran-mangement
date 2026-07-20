interface ArchivedOrderBannerProps {
  archivedAt?: string;
  archivedBy?: string;
  archiveReason?: string;
}

export default function ArchivedOrderBanner({
  archivedAt,
  archivedBy,
  archiveReason,
}: ArchivedOrderBannerProps) {
  return (
    <div className="ow-mark-warning" style={{ background: '#fef3c7', borderColor: '#f59e0b', color: '#78350f' }}>
      🗄️ هذا الطلب مؤرشف — بتاريخ {archivedAt} بواسطة {archivedBy}
      {archiveReason ? ` — السبب: ${archiveReason}` : ''}
    </div>
  );
}
