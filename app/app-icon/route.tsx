import { ImageResponse } from "next/og";

export function GET(request: Request) {
  const size = Number(new URL(request.url).searchParams.get("size") || 512);
  if (![180, 192, 512].includes(size)) return new Response("Invalid icon size", { status: 400 });
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#3f73ec", alignItems: "center", justifyContent: "center" }}>
      <svg width={size * 0.65} height={size * 0.65} viewBox="0 0 100 100">
        <rect x="12" y="20" width="76" height="69" rx="14" fill="#fffefa" />
        <path d="M12 40h76" stroke="#e0e7f2" strokeWidth="3" />
        <path d="M33 12v18M67 12v18" stroke="#fffefa" strokeWidth="8" strokeLinecap="round" />
        <rect x="28" y="52" width="12" height="12" rx="3" fill="#dceff5" />
        <rect x="44" y="52" width="12" height="12" rx="3" fill="#faefbf" />
        <rect x="60" y="52" width="12" height="12" rx="3" fill="#e8dcf7" />
        <path d="m36 75 8 7 19-17" stroke="#3f73ec" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </div>,
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } }
  );
}
