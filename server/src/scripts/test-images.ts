const candidateImages = [
  // Dash cam
  { type: 'dash-cam', url: 'https://images.unsplash.com/photo-1508873696983-2df5703bc20d?w=600&auto=format&fit=crop&q=80' },
  { type: 'dash-cam', url: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=600&auto=format&fit=crop&q=80' },
  { type: 'dash-cam', url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&auto=format&fit=crop&q=80' },
  { type: 'dash-cam', url: 'https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?w=600&auto=format&fit=crop&q=80' },
  
  // Helmets
  { type: 'helmet', url: 'https://images.unsplash.com/photo-1558981408-db0ecd8a1ee4?w=600&auto=format&fit=crop&q=80' },
  { type: 'helmet', url: 'https://images.unsplash.com/photo-1558981420-87aa9210d90d?w=600&auto=format&fit=crop&q=80' },
  { type: 'helmet', url: 'https://images.unsplash.com/photo-1571171637578-41bc2dd41cd2?w=600&auto=format&fit=crop&q=80' },

  // Pressure cookers / Cookware / Pots
  { type: 'pressure-cooker', url: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=600&auto=format&fit=crop&q=80' },
  { type: 'pressure-cooker', url: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=600&auto=format&fit=crop&q=80' },
  { type: 'pressure-cooker', url: 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=600&auto=format&fit=crop&q=80' },

  // Air Fryer / Small Appliance
  { type: 'air-fryer', url: 'https://images.unsplash.com/photo-1544233726-9f1d2b27be8b?w=600&auto=format&fit=crop&q=80' },
  { type: 'air-fryer', url: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&auto=format&fit=crop&q=80' },

  // Mixer grinder / Blender
  { type: 'mixer-grinder', url: 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=600&auto=format&fit=crop&q=80' },

  // Induction cooktop
  { type: 'induction-cooktop', url: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&auto=format&fit=crop&q=80' },

  // Dumbbells
  { type: 'dumbbell', url: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=600&auto=format&fit=crop&q=80' },
  { type: 'dumbbell', url: 'https://images.unsplash.com/photo-1586401100295-7a8096fd231a?w=600&auto=format&fit=crop&q=80' },

  // Running shoes
  { type: 'running-shoes', url: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600&auto=format&fit=crop&q=80' },

  // Neckband
  { type: 'neckband', url: 'https://images.unsplash.com/photo-1577174881658-0f30ed549adc?w=600&auto=format&fit=crop&q=80' }
];

async function main() {
  console.log('Testing image URLs...');
  for (const c of candidateImages) {
    try {
      const res = await fetch(c.url, { method: 'HEAD' });
      console.log(`[${c.type}] ${res.status === 200 ? 'OK 200' : res.status} -> ${c.url}`);
    } catch (e: any) {
      console.log(`[${c.type}] ERROR: ${e.message}`);
    }
  }
}

main();
