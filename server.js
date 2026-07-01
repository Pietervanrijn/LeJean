require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.LIGHTSPEED_API_KEY;
const API_SECRET = process.env.LIGHTSPEED_API_SECRET;
const getAuth = () => Buffer.from(API_KEY + ':' + API_SECRET).toString('base64');
async function fetchOrders() {
  let all = [], page = 1, more = true;
  while (more) {
    try {
      const r = await axios.get('https://api.webshopapp.com/nl/orders.json', {
        headers: { Authorization: 'Basic ' + getAuth() },
        params: { status: 'processing_awaiting_shipment', limit: 250, page }
      });
      const o = r.data.orders || [];
      all = all.concat(o);
      more = o.length >= 250;
      page++;
    } catch(e) { console.error(e.message); more = false; }
  }
  return all;
}
function dagFilter(orders) {
  return orders.filter(o => JSON.stringify(o).toUpperCase().includes('DAGBEZORGING'));
}
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));
app.get('/api/orders', async (req, res) => {
  try {
    const filtered = dagFilter(await fetchOrders());
    res.json({ orders: filtered, total: filtered.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.listen(PORT, () => console.log('Chill-Bill port ' + PORT));
