# 🚀 OptiNetX Deployment Guide

This guide will help you deploy OptiNetX so anyone can access it via URL.

## 📋 Prerequisites

Before deploying, ensure you have:
- A GitHub account (free)
- Git installed on your computer
- A code editor (VS Code recommended)

## 🌟 Recommended: Deploy to Vercel (Easiest & Free)

### Step 1: Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the "+" icon → "New repository"
3. Name it: `optinetx-network-planner`
4. Make it Public
5. Click "Create repository"

### Step 2: Upload Your Project to GitHub

```bash
# Open terminal in your project folder
cd "C:\Users\Visitor\Desktop\ROUTER MAPPING PRJ\project"

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit files
git commit -m "Initial commit - OptiNetX Network Planner"

# Connect to your GitHub repository (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/optinetx-network-planner.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 3: Deploy to Vercel

1. Go to [Vercel.com](https://vercel.com)
2. Click "Sign Up" and choose "Continue with GitHub"
3. Click "Import Project"
4. Import your `optinetx-network-planner` repository
5. Click "Deploy"
6. Wait 1-2 minutes for deployment to complete
7. Get your live URL: `https://optinetx-network-planner.vercel.app`

**✅ Done! Your app is now live!**

---

## 🎯 Alternative: Deploy to Netlify

### Quick Deploy via Drag & Drop

1. Go to [Netlify.com](https://netlify.com)
2. Sign up with GitHub
3. Drag your entire project folder to Netlify Drop
4. Get your URL: `https://your-site-name.netlify.app`

### Deploy via Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Navigate to project
cd "C:\Users\Visitor\Desktop\ROUTER MAPPING PRJ\project"

# Login to Netlify
netlify login

# Deploy
netlify deploy --prod
```

---

## 📄 Alternative: GitHub Pages (Free)

### Enable GitHub Pages

1. Push your code to GitHub (see Step 2 above)
2. Go to your repository on GitHub
3. Click "Settings" → "Pages"
4. Under "Source", select "main" branch
5. Select "/ (root)" folder
6. Click "Save"
7. Wait 2-3 minutes
8. Your URL: `https://YOUR_USERNAME.github.io/optinetx-network-planner/landing.html`

**Note:** With GitHub Pages, you need to access:
- Landing page: `/landing.html`
- Main app: `/index.html`

---

## 🖥️ Local Testing Before Deploy

Test your application locally:

```bash
# Option 1: Using Python
python -m http.server 8000

# Option 2: Using Node.js
npx http-server -p 8000

# Option 3: Using npm script
npm install
npm start
```

Then visit: `http://localhost:8000/landing.html`

---

## 🔧 Post-Deployment Configuration

### Custom Domain (Optional)

#### For Vercel:
1. Go to your project dashboard
2. Click "Settings" → "Domains"
3. Add your custom domain (e.g., `optinetx.com`)
4. Follow DNS configuration instructions

#### For Netlify:
1. Go to "Domain settings"
2. Click "Add custom domain"
3. Configure DNS records as instructed

---

## 📱 Share Your Application

Once deployed, share your URL:

**Vercel URL Format:**
```
https://optinetx-network-planner.vercel.app
```

**Netlify URL Format:**
```
https://optinetx-network-planner.netlify.app
```

**GitHub Pages URL Format:**
```
https://YOUR_USERNAME.github.io/optinetx-network-planner/landing.html
```

---

## 🎨 Custom URLs

### Vercel Default Routes:
- Landing page: `https://your-app.vercel.app/` (configured via `vercel.json`)
- Main app: `https://your-app.vercel.app/app`

### Netlify Default Routes:
- Landing page: `https://your-app.netlify.app/` (configured via `netlify.toml`)
- Main app: `https://your-app.netlify.app/app`

---

## 🐛 Troubleshooting

### Issue: Map not loading
- Check browser console for errors
- Ensure internet connection is active
- Verify Leaflet CDN is accessible

### Issue: 404 Error on deployment
- Ensure `landing.html` and `index.html` are in root folder
- Check deployment configuration files (`vercel.json`, `netlify.toml`)

### Issue: Git push failed
```bash
# If remote already exists
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/optinetx-network-planner.git
git push -u origin main
```

---

## 📊 Monitoring Your Deployment

### Vercel Analytics
- Go to your project dashboard
- Click "Analytics" tab
- View visitor statistics and performance

### Netlify Analytics
- Go to your site dashboard
- Click "Analytics" in sidebar
- View traffic and performance metrics

---

## 🔒 Security Notes

- API keys: Currently using free public APIs (no keys required)
- HTTPS: Automatically enabled on Vercel and Netlify
- CORS: No issues as all resources are loaded via CDN

---

## 📞 Need Help?

- **Vercel Support**: [vercel.com/support](https://vercel.com/support)
- **Netlify Support**: [netlify.com/support](https://netlify.com/support)
- **GitHub Pages Docs**: [docs.github.com/pages](https://docs.github.com/pages)

---

**Made by RITWIK KUMAR** 🚀

Good luck with your deployment!
