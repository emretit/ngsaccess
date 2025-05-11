
exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle OPTIONS request (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ 
        response: 'deny',
        confirmation: 'relay_closed',
        error: 'Sadece POST istekleri desteklenmektedir' 
      })
    };
  }

  try {
    // Parse the request body
    const body = JSON.parse(event.body);
    console.log('Gelen veri:', body);

    // Validate user_id_serial format
    if (!body.user_id_serial) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          response: 'deny',
          confirmation: 'relay_closed',
          error: 'Geçersiz istek formatı: user_id_serial alanı eksik'
        })
      };
    }

    const userIdSerialValue = body.user_id_serial;
    
    // Parse the card data
    const parsedData = parseCardData(userIdSerialValue);
    if (!parsedData) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          response: 'deny',
          confirmation: 'relay_closed',
          error: 'Geçersiz istek formatı: user_id_serial değeri doğru formatta değil'
        })
      };
    }

    const { cardNumber, deviceSerial } = parsedData;

    // This is a demo implementation - in a real scenario you would 
    // integrate with your database
    // For demo purposes, let's accept cards with numbers that are even
    const isAccessGranted = parseInt(cardNumber) % 2 === 0;
    
    if (!isAccessGranted) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          response: 'deny',
          confirmation: 'relay_closed',
          error: 'Kart numarası kayıtlı değil veya erişim izni yok'
        })
      };
    }

    // Access granted
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        response: 'open_relay',
        confirmation: 'relay_opened'
      })
    };

  } catch (error) {
    console.error('Kart okuyucu API hatası:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        response: 'deny',
        confirmation: 'relay_closed',
        error: 'Sistem hatası: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata')
      })
    };
  }
};

/**
 * Parses card number and serial number from userIdSerial
 */
function parseCardData(userIdSerialValue) {
  // Check for %T format
  if (!userIdSerialValue.includes('%T')) {
    return null;
  }

  // Parse the %T,<serial_number> format
  const parts = userIdSerialValue.split(',');
  if (parts.length < 2) {
    return null;
  }

  // Card number (value after %T)
  const cardPart = parts[0];
  const cardNumber = cardPart.replace('%T', '');

  // Device serial number (value after comma)
  const deviceSerial = parts[1];

  if (!cardNumber || !deviceSerial) {
    return null;
  }

  return { cardNumber, deviceSerial };
}
