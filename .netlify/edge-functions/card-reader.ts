export const config = {
    path: "/api/card-reader",
};

export default async (request: Request, context: any) => {
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    let body: any;
    try {
        body = await request.json();
        console.log("📟 Gelen JSON:", JSON.stringify(body));
    } catch (e) {
        console.error("JSON çözümleme hatası:", e);
        return new Response("Bad JSON", { status: 400 });
    }

    // "user_id,serial" anahtarını işle
    const combinedValue = body["user_id,serial"];
    console.log("📟 Birleşik değer:", combinedValue);

    if (combinedValue) {
        // Virgülle ayrılmış değerleri parçala
        const [user_id, serial] = combinedValue.split(",");
        console.log("📟 Kart Okundu, user_id:", user_id, "serial:", serial);

        // Şimdilik her zaman aç komutu dönüyoruz
        const response = { response: "open_relay" };
        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } else {
        console.error("📟 user_id,serial alanı bulunamadı");
        return new Response(JSON.stringify({ error: "Missing user_id,serial field" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }
};
