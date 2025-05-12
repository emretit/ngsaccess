
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
            body = { error: "JSON parse error" };
        }

        if (!body) {
            console.log("📟 Body NULL");
            throw new Error("Invalid body format");
        }

        // Olası tüm kart okuyucu formatlarını kontrol et
        let combinedValue = null;
        
        // 1. "user_id,serial" formatı
        if (body["user_id,serial"]) {
            combinedValue = body["user_id,serial"];
            console.log("📟 Format 1 bulundu: user_id,serial =", combinedValue);
        } 
        // 2. "user_id_serial" formatı 
        else if (body["user_id_serial"]) {
            combinedValue = body["user_id_serial"];
            console.log("📟 Format 2 bulundu: user_id_serial =", combinedValue);
        }
        // 3. Başka bir key'in değeri içinde kart bilgisi var mı kontrol et
        else {
            console.log("📟 Standart format bulunamadı. Tüm body'yi analiz ediyorum...");
            // Tüm body'yi döngüye alıp değerleri kontrol et
            for (const key in body) {
                const value = body[key];
                if (typeof value === "string" && (value.includes("%T") || value.includes(","))) {
                    combinedValue = value;
                    console.log(`📟 Alternatif format bulundu: ${key} =`, value);
                    break;
                }
            }
        }

        if (combinedValue) {
            // Hem virgül hem de noktalı virgül için parse et
            let parts;
            if (combinedValue.includes(",")) {
                parts = combinedValue.split(",");
                console.log("📟 Virgülle ayrılmış değerler:", parts);
            } else if (combinedValue.includes(";")) {
                parts = combinedValue.split(";");
                console.log("📟 Noktalı virgülle ayrılmış değerler:", parts);
            } else {
                parts = [combinedValue]; // Tek bir değer
                console.log("📟 Bölünemeyen tek değer:", parts);
            }

            // Kart ID'sini tespit et
            let user_id = parts[0];
            if (user_id.includes("%T")) {
                user_id = user_id.replace("%T", "test-kart-id");
            }
            
            // Seri numarasını tespit et
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
            console.log("📟 Kart bilgisi bulunamadı, tüm body:", JSON.stringify(body));
            return new Response(JSON.stringify({
                error: "Missing card identification field",
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
