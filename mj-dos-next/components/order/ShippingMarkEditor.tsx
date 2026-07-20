interface ShippingMarkEditorProps {
  newMark: string;
  onMarkChange: (val: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function ShippingMarkEditor({ newMark, onMarkChange, onSave, onCancel }: ShippingMarkEditorProps) {
  return (
    <div className="ow-mark-change-form">
      <input className="ow-mark-input" type="text" value={newMark} onChange={(e) => onMarkChange(e.target.value)} placeholder="أدخل العلامة الجديدة" />
      <button className="ow-mark-submit" onClick={onSave} disabled={!newMark.trim()}>💾 حفظ</button>
      <button className="ow-mark-cancel" onClick={onCancel}>إلغاء</button>
    </div>
  );
}
