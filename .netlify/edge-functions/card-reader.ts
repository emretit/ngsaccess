export const config = {
    path: "/api/card-reader",
};

export default async (request: Request, context: any) => {
    // Host bilgisini kontrol edip test edelim
    const url = new URL(request.url);
    const host = url.host; // 'localhost:8888' veya 'ngsplus.app'
    const protocol = url.protocol; // 'http:' veya 'https:'

    console.log(`📟 İstek URL: ${request.url}`);
    console.log(`📟 Host: ${host}, Protocol: ${protocol}`);

    // CORS desteği ekliyoruz
    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
        });
    }

    if (request.method !== "POST") {
        console.log("📟 Yanlış HTTP metodu:", request.method);
        return new Response("Method Not Allowed", {
            status: 405,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "text/plain",
            }
        });
    }

    console.log("📟 İstek alındı:", request.url);
    console.log("📟 İstek başlıkları:", JSON.stringify(Object.fromEntries([...request.headers])));

    let body: any;
    try {
        const text = await request.text();
        console.log("📟 Gelen ham veri:", text);

        try {
            body = JSON.parse(text);
            console.log("📟 Gelen JSON:", JSON.stringify(body));
        } catch (e) {
            console.error("📟 JSON çözümleme hatası:", e);
            return new Response(JSON.stringify({ error: "Invalid JSON", details: String(e) }), {
                status: 400,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json",
                },
            });
        }
    } catch (e) {
        console.error("📟 İstek gövdesi okuma hatası:", e);
        return new Response(JSON.stringify({ error: "Error reading request body", details: String(e) }), {
            status: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            },
        });
    }

    // "user_id,serial" anahtarını işle
    const combinedValue = body["user_id,serial"];
    console.log("📟 Birleşik değer:", combinedValue);

    if (combinedValue) {
        // Virgülle ayrılmış değerleri parçala
        const parts = combinedValue.split(",");
        const user_id = parts[0];
        const serial = parts.length > 1 ? parts[1] : "";

        console.log("📟 Kart Okundu, user_id:", user_id, "serial:", serial);

        // Test sonuçlarını da yanıta ekleyelim
        const response = {
            response: "open_relay",
            host: host,
            protocol: protocol,
            env: process.env.NODE_ENV || "unknown"
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            },
        });
    } else {
        console.error("📟 user_id,serial alanı bulunamadı");
        return new Response(JSON.stringify({
            error: "Missing user_id,serial field",
            host: host,
            protocol: protocol
        }), {
            status: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            },
        });
    }
};
