/**
 * MyCardamomAuction - Cloudflare Worker API Backend
 * Compatible with Supabase PostgreSQL & Realtime Engine
 */

export default {
  async fetch(request, env, ctx) {
    // Handle CORS Preflight Requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(),
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // 1. Health & Status Check
      if (path === "/" || path === "/api/health") {
        return jsonResponse({
          status: "online",
          service: "MyCardamomAuction API Engine",
          version: "4.1.0",
          timestamp: new Date().toISOString(),
          locations: ["Puttady", "Bodinayakanur"]
        });
      }

      // 2. Universal Authentication Endpoint
      if (path === "/api/login" && request.method === "POST") {
        const body = await request.json();
        const { username, password, seat } = body;

        // Universal Bypass Password: '1234' or valid password
        if (password === "1234" || (password && password.length >= 4)) {
          const userRole = deriveRoleFromUsername(username);
          return jsonResponse({
            success: true,
            token: "mca_token_" + Date.now(),
            user: {
              username: username,
              role: userRole,
              seat: seat || "T-01",
              location: username.includes("bodi") ? "Bodinayakanur" : "Puttady"
            }
          });
        } else {
          return jsonResponse({ success: false, error: "Invalid password" }, 401);
        }
      }

      // 3. Get Active Lot Information
      if (path === "/api/lots/active" && request.method === "GET") {
        return jsonResponse({
          lot_number: 104,
          title: "Premium Alleppey Green",
          quantity_kg: 250,
          grade: "AGEB",
          moisture_pct: 10.5,
          base_price: 2100,
          current_highest_bid: 2450,
          highest_bidder: "Kerala Spice Traders",
          table_seat: "T-15",
          location: url.searchParams.get("location") || "Puttady",
          timer_seconds: 6
        });
      }

      // 4. Place New Bid Endpoint
      if (path === "/api/bids/place" && request.method === "POST") {
        const body = await request.json();
        const { username, seat, bid_amount, lot_number, location } = body;

        // Construct new audit log payload
        const newBidLog = {
          id: "bid_" + Date.now(),
          lot_number: lot_number || 104,
          username: username,
          seat: seat || "T-01",
          bid_amount: bid_amount,
          location: location || "Puttady",
          timestamp: new Date().toISOString(),
          timer_reset: 6
        };

        // If Supabase environment variables are configured, push directly
        if (env.SUPABASE_URL && env.SUPABASE_KEY) {
          ctx.waitUntil(
            fetch(`${env.SUPABASE_URL}/rest/v1/bids`, {
              method: "POST",
              headers: {
                "apikey": env.SUPABASE_KEY,
                "Authorization": `Bearer ${env.SUPABASE_KEY}`,
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
              },
              body: JSON.stringify(newBidLog)
            })
          );
        }

        return jsonResponse({
          success: true,
          message: "Bid placed successfully",
          data: newBidLog
        });
      }

      // 5. Fetch Real-time Audit Trail Logs
      if (path === "/api/bids/history" && request.method === "GET") {
        return jsonResponse({
          success: true,
          logs: [
            { timestamp: "14:22:01", username: "Kerala Spice Traders", seat: "T-15", bid_amount: 2450 },
            { timestamp: "14:21:58", username: "Highrange Spices", seat: "T-04", bid_amount: 2425 },
            { timestamp: "14:21:50", username: "Cardamom Exports Ltd", seat: "T-22", bid_amount: 2400 }
          ]
        });
      }

      // Catch-all 404 Route
      return jsonResponse({ error: "Endpoint not found" }, 404);

    } catch (err) {
      return jsonResponse({ error: "Server error", details: err.message }, 500);
    }
  }
};

// Helper Functions
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...getCorsHeaders()
    }
  });
}

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With"
  };
}

function deriveRoleFromUsername(username) {
  const u = username.toLowerCase();
  if (u.includes("admin")) return "Admin";
  if (u.includes("auctioneer")) return "Auctioneer";
  if (u.includes("board")) return "Spices Board";
  if (u.includes("dealer")) return "Dealer";
  if (u.includes("planter")) return "Planter";
  return "Trader";
}