// Edge function yapılandırması
export const config = {
    path: "/api/card-reader",
};

// Ana edge function handler
export default async (request) => {
    // Tüm istek detaylarını logla
    console.log("📟 =============================================");
    console.log("📟 KART OKUYUCU İSTEĞİ ALINDI!");
    console.log("📟 Timestamp:", new Date().toISOString());
    console.log("📟 URL:", request.url);
    console.log("📟 Method:", request.method);
    console.log("📟 Headers:", JSON.stringify(Object.fromEntries([...request.headers])));

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

    try {
        // İstek gövdesini işle
        console.log("📟 POST isteği alındı, body okunuyor...");
        const text = await request.text();
        console.log("📟 Raw Body:", text);

        let body;
        try {
            body = JSON.parse(text);
            console.log("📟 Parsed Body:", JSON.stringify(body));
        } catch (error) {
            console.log("📟 JSON parse hatası:", error);
            console.log("📟 Ham veriyi analiz ediyorum...");

            // JSON parse hatası olursa, raw body'yi analiz etmeye çalış
            if (text.includes("user_id,serial")) {
                console.log("📟 user_id,serial bulundu, manuel olarak işleniyor");
                const matches = text.match(/"user_id,serial"\s*:\s*"([^"]+)"/);
                if (matches && matches[1]) {
                    const value = matches[1];
                    console.log("📟 Eşleşen değer:", value);
                    body = { "user_id,serial": value };
                }
            }
        }

        if (!body) {
            console.log("📟 Body NULL");
            throw new Error("Invalid body format");
        }

        // "user_id,serial" anahtarını işle
        const combinedValue = body["user_id,serial"];
        console.log("📟 Birleşik değer:", combinedValue);

        if (combinedValue) {
            // Virgülle ayrılmış değerleri parçala
            const parts = combinedValue.split(",");
            const user_id = parts[0].replace("%T", "test-kart-id"); // %T değerini değiştir
            const serial = parts.length > 1 ? parts[1] : "";

            console.log("📟 Kart Okundu, user_id:", user_id, "serial:", serial);

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
        } else {
            console.log("📟 user_id,serial alanı bulunamadı, tüm body:", JSON.stringify(body));
            return new Response(JSON.stringify({
                error: "Missing user_id,serial field",
                received: body
            }), {
                status: 400,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json",
                },
            });
        }
    } catch (error) {
        // Hata yakalama
        console.log("📟 HATA:", error.message);
        return new Response(JSON.stringify({
            error: "Server error",
            message: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            },
        });
    } finally {
        console.log("📟 İstek işleme tamamlandı");
        console.log("📟 =============================================");
    }
}; 