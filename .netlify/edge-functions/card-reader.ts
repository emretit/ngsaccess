export const config = {
    path: "/api/card-reader",
};

export default async (request: Request) => {
    try {
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
            return new Response("Method Not Allowed", {
                status: 405,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "text/plain",
                }
            });
        }

        const text = await request.text();
        const body = JSON.parse(text);

        const response = { "response": "open_relay" };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: "Server error" }), {
            status: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            },
        });
    }
};
