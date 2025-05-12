
// Deno ile çalışacak şekilde yapılandırılmış Netlify Edge Function
export default async (request, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle OPTIONS request (CORS preflight)
  if (request.method === 'OPTIONS') {
    return new Response('', {
      status: 204,
      headers
    });
  }

  // Only accept POST requests
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ 
        response: 'deny',
        confirmation: 'relay_closed',
        error: 'Sadece POST istekleri desteklenmektedir' 
      }),
      { 
        status: 405,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      }
    );
  }

  try {
    // Parse the request body
    const body = await request.json();
    console.log('Gelen veri:', body);

    // Check if user_id_serial or user_id,serial exists
    const userIdSerialValue = body.user_id_serial || body['user_id,serial'];
    
    if (!userIdSerialValue) {
      return new Response(
        JSON.stringify({
          response: 'deny',
          confirmation: 'relay_closed',
          error: 'Geçersiz istek formatı: user_id_serial veya user_id,serial alanı eksik'
        }),
        { 
          status: 400,
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Parse the card data
    const parsedData = parseCardData(userIdSerialValue);
    if (!parsedData) {
      return new Response(
        JSON.stringify({
          response: 'deny',
          confirmation: 'relay_closed',
          error: 'Geçersiz istek formatı: kart verisi doğru formatta değil'
        }),
        { 
          status: 400,
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    const { cardNumber, deviceSerial } = parsedData;

    // This is a demo implementation - in a real scenario you would 
    // integrate with your database
    // For demo purposes, let's accept cards with numbers that are even
    const isAccessGranted = parseInt(cardNumber) % 2 === 0;
    
    if (!isAccessGranted) {
      return new Response(
        JSON.stringify({
          response: 'deny',
          confirmation: 'relay_closed',
          error: 'Kart numarası kayıtlı değil veya erişim izni yok'
        }),
        { 
          status: 200,
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Access granted
    return new Response(
      JSON.stringify({
        response: 'open_relay',
        confirmation: 'relay_opened'
      }),
      { 
        status: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Kart okuyucu API hatası:', error);
    return new Response(
      JSON.stringify({
        response: 'deny',
        confirmation: 'relay_closed',
        error: 'Sistem hatası: ' + error.message
      }),
      { 
        status: 500,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      }
    );
  }
};

/**
 * Parses card number and serial number from userIdSerial
 * Format can be either %T123456,DEVICE001 or just 123456,DEVICE001
 */
function parseCardData(userIdSerialValue) {
  // Handle if the value is directly a card number + device serial
  let cardNumber, deviceSerial;
  
  if (userIdSerialValue.includes(',')) {
    // Split by comma
    const parts = userIdSerialValue.split(',');
    if (parts.length < 2) return null;
    
    // First part may or may not have %T
    cardNumber = parts[0].replace('%T', '');
    deviceSerial = parts[1];
  } else {
    // No comma, assume the whole string is a card number
    cardNumber = userIdSerialValue.replace('%T', '');
    deviceSerial = 'UNKNOWN';
  }

  if (!cardNumber) {
    return null;
  }

  return { cardNumber, deviceSerial };
}
