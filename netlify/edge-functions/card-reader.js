// Edge function yapılandırması
export const config = {
    path: "/api/card-reader",
};

// Ana edge function handler
export default async (request) => {
    console.log("📟 Edge Function çağrıldı!");
    try {
        console.log("📟 Method:", request.method);

        // CORS OPTIONS desteği
        if (request.method === "OPTIONS") {
            console.log("📟 OPTIONS request");
            return new Response(null, {
                status: 204,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                },
            });
        }

        // Sadece POST isteklerini kabul et
        if (request.method !== "POST") {
            console.log("📟 POST dışı istek");
            return new Response("Method Not Allowed", {
                status: 405,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "text/plain",
                }
            });
        }

        // İstek gövdesini işle
        console.log("📟 POST isteği alındı, body okunuyor...");
        const text = await request.text();
        console.log("📟 Raw Body:", text);

        const body = JSON.parse(text);
        console.log("📟 Parsed Body:", JSON.stringify(body));

        // Kart okutulunca açma komutu döndür
        const response = { "response": "open_relay" };
        console.log("📟 Yanıt döndürülüyor:", JSON.stringify(response));

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            },
        });
    } catch (error) {
        // Hata yakalama
        console.log("📟 HATA:", error);
        return new Response(JSON.stringify({ error: "Server error", message: String(error) }), {
            status: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            },
        });
    }
}; 