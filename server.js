require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.LIGHTSPEED_API_KEY;
const API_SECRET = process.env.LIGHTSPEED_API_SECRET;
const SHOP = 'nl';

const getAuth = () => Buffer.from(API_KEY + ':' + API_SECRET).toString('base64');
const apiHeaders = () => ({ Authorization: 'Basic ' + getAuth() });

async function fetchOrders() {
  let all = [], page = 1, more = true;
  while (more) {
    try {
      const r = await axios.get('https://api.webshopapp.com/' + SHOP + '/orders.json', {
        headers: apiHeaders(),
        params: { status: 'processing_awaiting_shipment', limit: 250, page }
      });
      const orders = r.data.orders || [];
      all = all.concat(orders);
      more = orders.length >= 250;
      page++;
    } catch(e) { console.error('fetchOrders error:', e.message); more = false; }
  }
  return all;
}

async function enrichOrders(orders) {
  const dagOrders = orders.filter(o => JSON.stringify(o).toUpperCase().includes('DAGBEZORGING'));
  const enriched = dagOrders.map((order) => {
    const firstName = order.firstname || '';
    const middleName = order.middlename || '';
    const lastName = order.lastname || '';
    const klant = [firstName, middleName, lastName].filter(Boolean).join(' ') || order.email || 'Onbekend';
    let shippingMethod = order.shippingTitle || order.shippingMethod || 'DAGBEZORGING';
    const orderStr = JSON.stringify(order);
    const dagMatch = orderStr.match(/"([^"]*[Dd][Aa][Gg][Bb][Ee][Zz][Oo][Rr][Gg][Ii][Nn][Gg][^"]*)"/);
    if (dagMatch) shippingMethod = dagMatch[1];
    const ordNummer = String(order.number || '').toUpperCase().startsWith('ORD') ? String(order.number) : 'ORD' + order.number;
    return { ...order, _klant: klant, _ordNummer: ordNummer, _shippingMethod: shippingMethod };
  });
  return enriched;
}

app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await fetchOrders();
    const enriched = await enrichOrders(orders);
    const methods = [...new Set(enriched.map(o => o._shippingMethod).filter(Boolean))].sort();
    res.json({ orders: enriched, total: enriched.length, shippingMethods: methods });
  } catch(e) {
    console.error('API error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log('Chill-Bill running on port ' + PORT));
