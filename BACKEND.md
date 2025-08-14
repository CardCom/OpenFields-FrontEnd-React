# Backend Implementation Example

This project requires a backend server to handle the LowProfile deal creation. Below are examples for different backend technologies.

## Required Endpoint

**POST/GET** `/init`

**Response:**
```json
{
    "LowProfileId": "63fca7b4-85a8-4698-9f17-a1739920d958"
}
```

## Node.js/Express Example

```javascript
const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

app.get('/init', async (req, res) => {
    try {
        const response = await axios.post('https://secure.cardcom.solutions/api/v11/LowProfile/Create', {
            TerminalNumber: process.env.CARDCOM_TERMINAL,
            UserName: process.env.CARDCOM_USERNAME,
            APIKey: process.env.CARDCOM_API_KEY,
            // Additional LowProfile parameters...
        });
        
        res.json({ LowProfileId: response.data.LowProfileCode });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create LowProfile deal' });
    }
});

app.listen(8000, () => {
    console.log('Backend server running on port 8000');
});
```

## PHP Example

```php
<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $_SERVER['REQUEST_URI'] === '/init') {
    $data = [
        'TerminalNumber' => $_ENV['CARDCOM_TERMINAL'],
        'UserName' => $_ENV['CARDCOM_USERNAME'],
        'APIKey' => $_ENV['CARDCOM_API_KEY'],
        // Additional LowProfile parameters...
    ];
    
    $response = file_get_contents(
        'https://secure.cardcom.solutions/api/v11/LowProfile/Create',
        false,
        stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => 'Content-Type: application/json',
                'content' => json_encode($data)
            ]
        ])
    );
    
    $result = json_decode($response, true);
    echo json_encode(['LowProfileId' => $result['LowProfileCode']]);
}
?>
```

## Python/Flask Example

```python
from flask import Flask, jsonify
from flask_cors import CORS
import requests
import os

app = Flask(__name__)
CORS(app)

@app.route('/init', methods=['GET'])
def init_lowprofile():
    try:
        response = requests.post('https://secure.cardcom.solutions/api/v11/LowProfile/Create', json={
            'TerminalNumber': os.environ['CARDCOM_TERMINAL'],
            'UserName': os.environ['CARDCOM_USERNAME'],
            'APIKey': os.environ['CARDCOM_API_KEY'],
            # Additional LowProfile parameters...
        })
        
        data = response.json()
        return jsonify({'LowProfileId': data['LowProfileCode']})
    except Exception as e:
        return jsonify({'error': 'Failed to create LowProfile deal'}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8000, debug=True)
```

## Environment Variables

Make sure to set these environment variables in your backend:

```bash
CARDCOM_TERMINAL=your_terminal_number
CARDCOM_USERNAME=your_username  
CARDCOM_API_KEY=your_api_key
```

## Security Notes

- Never expose CardCom credentials in frontend code
- Use HTTPS in production
- Implement proper error handling
- Add request validation and rate limiting
- Consider implementing webhook handlers for payment notifications
