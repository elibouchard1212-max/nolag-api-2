export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { fn } = req.query;
  if (!fn) {
    return res.status(400).json({ error: 'Missing flight number' });
  }

  const key = process.env.AVIATIONSTACK_KEY;
  if (!key) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const url = `http://api.aviationstack.com/v1/flights?access_key=${key}&flight_iata=${fn.toUpperCase()}&limit=1`;
    const response = await fetch(url);
    const raw = await response.json();

    if (!raw.data || raw.data.length === 0) {
      return res.status(404).json({ error: 'Flight not found' });
    }

    const f = raw.data[0];
    const depIATA = f.departure?.iata;
    const arrIATA = f.arrival?.iata;
    const depCity = f.departure?.airport || depIATA;
    const arrCity = f.arrival?.airport || arrIATA;

    function tzOffset(isoWithOffset) {
      if (!isoWithOffset) return 0;
      const m = isoWithOffset.match(/([+-])(\d{2}):(\d{2})$/);
      if (!m) return 0;
      const sign = m[1] === '+' ? 1 : -1;
      return sign * (parseInt(m[2]) + parseInt(m[3]) / 60);
    }

    const depSched = f.departure?.scheduled;
    const arrSched = f.arrival?.scheduled;
    const otz = tzOffset(depSched);
    const dtz = tzOffset(arrSched);
    const depLocal = depSched ? new Date(depSched) : null;
    const deph = depLocal ? ((depLocal.getUTCHours() + otz + 24) % 24) : 18;
    const dur = (depSched && arrSched)
      ? (new Date(arrSched) - new Date(depSched)) / 3600000
      : 8;

    return res.status(200).json({
      o: depIATA, oc: depCity,
      d: arrIATA, dc: arrCity,
      otz, dtz,
      deph: Math.round(deph),
      dur: Math.round(dur * 10) / 10,
      al: f.airline?.name || '',
    });

  } catch (err) {
    return res.status(500).json({ error: 'Lookup failed' });
  }
}
