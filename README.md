# OptiNetX - Network Planning Application

Professional WiFi/IoT network planning tool with AI-powered optimization, interactive mapping, and real-time coverage visualization.

## 🚀 Features

- **Interactive Map Interface**: Satellite view with street labels powered by Leaflet
- **AI Auto-Planning**: Intelligent router placement with hexagonal grid optimization
- **Real-time Coverage Heatmap**: Visual feedback (optimal/weak/interference/dead zones)
- **Router Management**: Individual router placement, deletion, and renumbering
- **Location Search**: Search by city name or GPS coordinates
- **Deployment Tracking**: Work orders and deployment status management
- **Fullscreen Mode**: Immersive planning experience
- **AI Suggestions**: Smart alternatives for optimizing coverage
- **Dark Techie UI**: Modern glassmorphism design with neon accents

## 🌐 Live Demo

Access the application at: `[Your Deployment URL]`

## 📁 Project Structure

```
project/
├── landing.html              # Landing page
├── index.html                # Main application
├── script.js                 # Core logic and AI algorithms
├── style.css                 # Styling and animations
├── Screenshot_27-8-2026_132030_dribbble.com.jpeg  # Landing page illustration
├── vercel.json              # Vercel deployment config
├── netlify.toml             # Netlify deployment config
└── README.md                # This file
```

## 🛠️ Technologies Used

- **Leaflet.js** - Interactive mapping
- **p5.js** - Canvas-based heatmap visualization
- **Turf.js** - Geospatial calculations
- **Vanilla JavaScript** - Core application logic
- **CSS3** - Modern UI with glassmorphism effects

## 📦 Deployment Options

### Option 1: Vercel (Recommended)
1. Install Vercel CLI: `npm install -g vercel`
2. Navigate to project folder
3. Run: `vercel`
4. Follow prompts to deploy

### Option 2: Netlify
1. Install Netlify CLI: `npm install -g netlify-cli`
2. Navigate to project folder
3. Run: `netlify deploy`
4. For production: `netlify deploy --prod`

### Option 3: GitHub Pages
1. Create a new GitHub repository
2. Push project files to the repository
3. Go to Settings > Pages
4. Select branch and root folder
5. Save and get your URL

### Option 4: Simple HTTP Server (Local Testing)
```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx http-server -p 8000
```

Then visit: `http://localhost:8000/landing.html`

## 🚀 Quick Start (Local)

1. Open `landing.html` in a modern web browser
2. Click "Launch App" to access the main planning tool
3. Search for a location or use the default (India)
4. Draw a region on the map
5. Use "AI Auto-Plan Region" to deploy routers
6. View AI suggestions and apply alternatives

## 👨‍💻 Developer

Made by **RITWIK KUMAR**

## 📄 License

This project is available for personal and educational use.

## 🔧 Configuration

### Default Map Location
Edit `script.js` line ~40 to change default location:
```javascript
.setView([28.6139, 77.2090], 18); // New Delhi, India
```

### Router Parameters
- Frequency: 2.4 GHz or 5 GHz
- Power Range: 100-1500 units
- Coverage calculation optimized for zero dead zones

## 🐛 Known Issues

- None currently reported

## 📞 Support

For issues or questions, please contact the developer.

---

**Note**: This application requires an active internet connection for map tiles and location search functionality.
