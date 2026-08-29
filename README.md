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
