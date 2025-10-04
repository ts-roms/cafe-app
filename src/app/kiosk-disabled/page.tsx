export default function KioskDisabledPage() {
  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Time Kiosk</h1>
      <div className="p-4 border rounded">
        <p className="text-sm">The Time Kiosk is currently disabled by the administrator.</p>
        <p className="text-xs opacity-70 mt-1">Please contact your admin if you believe this is a mistake.</p>
      </div>
    </div>
  );
}
