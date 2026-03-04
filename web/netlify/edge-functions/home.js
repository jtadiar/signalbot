const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>C13 Studios</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(ellipse at 50% 0%, #1a1a1f 0%, #0a0a0c 50%, #000 100%);
      color: #fff;
      overflow: hidden;
    }

    .container {
      text-align: center;
      position: relative;
      z-index: 1;
    }

    .logo {
      font-size: clamp(3rem, 10vw, 7rem);
      font-weight: 900;
      letter-spacing: -0.03em;
      line-height: 1;
      background: linear-gradient(180deg, #e8e8ee 0%, #c0c0c8 15%, #f5f5f7 30%, #8a8a95 50%, #b8b8c2 65%, #d5d5db 80%, #9a9aa5 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      filter: drop-shadow(0 2px 8px rgba(255,255,255,0.06));
      margin-bottom: 0.15em;
    }

    .logo-sub {
      font-size: clamp(1rem, 3vw, 1.6rem);
      font-weight: 900;
      letter-spacing: 0.35em;
      text-transform: uppercase;
      background: linear-gradient(180deg, #b0b0b8 0%, #7a7a85 50%, #a0a0aa 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 4rem;
    }

    .products {
      display: flex;
      gap: 1.25rem;
      justify-content: center;
      flex-wrap: wrap;
      padding: 0 1rem;
    }

    .product-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.65rem;
      width: 200px;
      height: 56px;
      border-radius: 14px;
      font-family: 'Inter', sans-serif;
      font-size: 0.9rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-decoration: none;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: pointer;
      position: relative;
      overflow: hidden;
    }

    .product-btn.active {
      background: linear-gradient(135deg, #18181c 0%, #222228 100%);
      border: 1px solid rgba(255,255,255,0.12);
      color: #fff;
      box-shadow: 0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06);
    }

    .product-btn.active:hover {
      border-color: rgba(255,255,255,0.25);
      box-shadow: 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1);
      transform: translateY(-2px);
    }

    .product-btn.locked {
      background: linear-gradient(135deg, #111114 0%, #18181c 100%);
      border: 1px solid rgba(255,255,255,0.05);
      color: rgba(255,255,255,0.2);
      cursor: default;
      box-shadow: 0 4px 24px rgba(0,0,0,0.3);
    }

    .lock-icon { width: 16px; height: 16px; opacity: 0.35; }

    .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

    .dot-live {
      background: #10b981;
      box-shadow: 0 0 8px rgba(16,185,129,0.5);
      animation: pulse 2.5s ease-in-out infinite;
    }

    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

    .noise {
      position: fixed;
      inset: 0;
      z-index: 0;
      opacity: 0.025;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
      background-size: 200px;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div class="noise"></div>
  <div class="container">
    <div class="logo">C13</div>
    <div class="logo-sub">Studios</div>

    <div class="products">
      <a href="/signalbot" class="product-btn active">
        <span class="dot dot-live"></span>
        Signalbot
      </a>
      <div class="product-btn locked">
        <svg class="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        Coming Soon
      </div>
      <div class="product-btn locked">
        <svg class="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        Coming Soon
      </div>
    </div>
  </div>
</body>
</html>`;

export default () => new Response(HTML, {
  headers: { "content-type": "text/html; charset=utf-8" },
});

export const config = { path: "/" };
